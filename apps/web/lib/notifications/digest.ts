import type { Json } from "@vilo/types";

import { createAdminClient } from "@/lib/supabase/admin";

export type DigestRunResult = {
  users_processed: number;
  digests_sent: number;
  items_drained: number;
  details: Array<{
    user_id: string;
    cadence: "daily" | "weekly";
    items: number;
    error?: string;
  }>;
};

// ──────────────────────────────────────────────────────────────────────────
// runDigestDrain — hourly tick.
//
// 1. Find every user with at least one unsent pending_digest_items row
//    AND at least one category preference where digest_mode != 'off'.
// 2. For each such user, check if "now" in their timezone matches their
//    digest_send_hour. Daily users → fire every day. Weekly users → fire
//    only on Mondays.
// 3. Group their unsent items by category, render one digest email + one
//    in-app entry, mark every item sent.
//
// Fire-and-forget per user — one failed user must not block others.
// ──────────────────────────────────────────────────────────────────────────

export async function runDigestDrain(): Promise<DigestRunResult> {
  const supabase = createAdminClient();

  // Distinct user_ids with pending unsent items.
  const { data: pendingUsers, error: pendingErr } = await supabase
    .from("pending_digest_items")
    .select("user_id")
    .is("sent_at", null)
    .limit(500);

  if (pendingErr) {
    throw new Error(`fetch pending digests failed: ${pendingErr.message}`);
  }

  const userIds = Array.from(
    new Set((pendingUsers ?? []).map((r) => r.user_id as string)),
  );

  const result: DigestRunResult = {
    users_processed: 0,
    digests_sent: 0,
    items_drained: 0,
    details: [],
  };

  if (userIds.length === 0) return result;

  // Load each user's settings + per-category digest_mode + email + display name.
  const [{ data: settings }, { data: prefs }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("user_notification_settings")
        .select("user_id, quiet_hours_timezone, digest_send_hour")
        .in("user_id", userIds),
      supabase
        .from("user_notification_preferences")
        .select("user_id, category_id, digest_mode")
        .in("user_id", userIds)
        .in("digest_mode", ["daily", "weekly"]),
      supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", userIds),
    ]);

  const settingsByUser = new Map<
    string,
    { timezone: string; send_hour: number }
  >(
    (settings ?? []).map((s) => [
      s.user_id as string,
      {
        timezone:
          (s.quiet_hours_timezone as string | null) ?? "Africa/Johannesburg",
        send_hour: (s.digest_send_hour as number | null) ?? 9,
      },
    ]),
  );

  // Per-user category modes: { user_id → { category_id → 'daily'|'weekly' } }
  const modesByUser = new Map<string, Map<string, "daily" | "weekly">>();
  for (const p of prefs ?? []) {
    const u = p.user_id as string;
    if (!modesByUser.has(u)) modesByUser.set(u, new Map());
    modesByUser
      .get(u)!
      .set(p.category_id as string, p.digest_mode as "daily" | "weekly");
  }

  const profileByUser = new Map<
    string,
    { full_name: string | null; email: string | null }
  >(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        full_name: p.full_name as string | null,
        email: p.email as string | null,
      },
    ]),
  );

  // Cache category labels for the digest email subjects.
  const { data: cats } = await supabase
    .from("notification_categories")
    .select("id, label");
  const labelById = new Map<string, string>(
    (cats ?? []).map((c) => [c.id as string, c.label as string]),
  );

  for (const userId of userIds) {
    const setting = settingsByUser.get(userId) ?? {
      timezone: "Africa/Johannesburg",
      send_hour: 9,
    };
    const profile = profileByUser.get(userId);
    if (!profile?.email) {
      // No email on file → still drain in-app, but skip email.
    }

    const { hour, isMonday } = currentLocalHour(setting.timezone);
    if (hour !== setting.send_hour) continue;

    const userModes = modesByUser.get(userId);
    if (!userModes || userModes.size === 0) continue;

    // Pull the user's unsent items grouped by category.
    const { data: items } = await supabase
      .from("pending_digest_items")
      .select("id, category_id, event_kind, title, body, link, created_at")
      .eq("user_id", userId)
      .is("sent_at", null)
      .order("created_at", { ascending: true })
      .limit(200);

    if (!items || items.length === 0) continue;

    // Filter to items whose category mode matches this firing.
    // - daily firings include all daily-mode categories
    // - weekly firings (Monday only) include all weekly-mode categories
    const includedCategoryIds = new Set<string>();
    for (const [catId, mode] of userModes) {
      if (mode === "daily") includedCategoryIds.add(catId);
      else if (mode === "weekly" && isMonday) includedCategoryIds.add(catId);
    }

    const eligible = items.filter((i) =>
      includedCategoryIds.has(i.category_id as string),
    );
    if (eligible.length === 0) continue;

    // Determine cadence label by majority of included categories.
    const hasWeekly = Array.from(includedCategoryIds).some(
      (id) => userModes.get(id) === "weekly",
    );
    const cadence: "daily" | "weekly" =
      hasWeekly && isMonday ? "weekly" : "daily";

    const groups = groupByCategory(eligible, labelById);

    try {
      if (profile?.email) {
        await supabase.from("notification_queue").insert({
          type: "notification_digest",
          user_id: userId,
          host_id: null,
          guest_id: null,
          category_id: "reviews",
          dedupe_key: null,
          payload: {
            recipient_email: profile.email,
            recipient_first_name: firstName(profile.full_name),
            cadence,
            groups,
          } as Json,
        });
      }

      // Single in-app entry summarising the digest.
      await supabase.rpc("enqueue_in_app_notification", {
        p_user_id: userId,
        p_kind: "notification_digest",
        p_title: `Your ${cadence} digest — ${eligible.length} update${eligible.length === 1 ? "" : "s"}`,
        p_body: groups
          .map((g) => `${g.items.length} ${g.category_label}`)
          .join(" · "),
        p_link: "/dashboard",
        p_payload: { cadence, group_count: groups.length },
        p_category_id: "admin_broadcasts",
        p_severity: "info",
      });

      // Mark every item sent.
      const ids = eligible.map((i) => i.id as string);
      await supabase
        .from("pending_digest_items")
        .update({ sent_at: new Date().toISOString() })
        .in("id", ids);

      result.users_processed += 1;
      result.digests_sent += 1;
      result.items_drained += eligible.length;
      result.details.push({ user_id: userId, cadence, items: eligible.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.details.push({
        user_id: userId,
        cadence,
        items: eligible.length,
        error: msg,
      });
    }
  }

  return result;
}

function firstName(full: string | null): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function currentLocalHour(timezone: string): {
  hour: number;
  isMonday: boolean;
} {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(new Date());
    const hour = parseInt(
      parts.find((p) => p.type === "hour")?.value ?? "0",
      10,
    );
    const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "")
      .toLowerCase()
      .slice(0, 3);
    return { hour, isMonday: weekday === "mon" };
  } catch {
    const d = new Date();
    return { hour: d.getUTCHours(), isMonday: d.getUTCDay() === 1 };
  }
}

function groupByCategory(
  items: Array<{
    category_id: string | null;
    title: string;
    body: string | null;
    link: string | null;
  }>,
  labelById: Map<string, string>,
): Array<{
  category_label: string;
  items: Array<{ title: string; body: string | null; link: string | null }>;
}> {
  const byCat = new Map<
    string,
    Array<{ title: string; body: string | null; link: string | null }>
  >();
  for (const it of items) {
    const cid = (it.category_id as string) ?? "other";
    if (!byCat.has(cid)) byCat.set(cid, []);
    byCat.get(cid)!.push({ title: it.title, body: it.body, link: it.link });
  }
  return Array.from(byCat.entries()).map(([cid, its]) => ({
    category_label: labelById.get(cid) ?? cid,
    items: its,
  }));
}
