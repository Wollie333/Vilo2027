import { createAdminClient } from "@/lib/supabase/admin";

const FANOUT_BATCH_SIZE = 5;

export type FanoutResult = {
  processed: number;
  total_emails_queued: number;
  details: Array<{
    broadcast_id: string;
    audience: string;
    emails_queued: number;
    error?: string;
  }>;
};

// Drains pending critical broadcasts:
//   1. Pick up to FANOUT_BATCH_SIZE critical broadcasts where
//      email_fanout_completed_at IS NULL and the active window is open.
//   2. Resolve the audience to a list of recipient (user_id, email).
//   3. Insert one notification_queue row per recipient with
//      type='broadcast_critical' and payload carrying the broadcast body.
//   4. Stamp email_fanout_completed_at on the broadcast so re-runs are no-ops.
//
// Email send itself happens via the existing email-worker drain.

export async function runBroadcastFanout(): Promise<FanoutResult> {
  const supabase = createAdminClient();

  const { data: broadcasts, error } = await supabase
    .from("broadcast_announcements")
    .select(
      "id, severity, audience, title, body, link_url, link_label, starts_at, ends_at, cancelled_at, email_fanout_completed_at",
    )
    .eq("severity", "critical")
    .is("email_fanout_completed_at", null)
    .is("cancelled_at", null)
    .lte("starts_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(FANOUT_BATCH_SIZE);

  if (error) {
    throw new Error(`fetch broadcasts failed: ${error.message}`);
  }

  const result: FanoutResult = {
    processed: 0,
    total_emails_queued: 0,
    details: [],
  };
  if (!broadcasts || broadcasts.length === 0) return result;

  for (const b of broadcasts) {
    // Skip if ends_at has passed.
    if (b.ends_at && new Date(b.ends_at as string).getTime() < Date.now()) {
      continue;
    }
    result.processed += 1;

    try {
      const recipients = await loadAudience(supabase, b.audience as string);
      const queueRows = recipients.map((u) => ({
        type: "broadcast_critical",
        user_id: u.user_id,
        host_id: null,
        guest_id: null,
        category_id: "admin_broadcasts",
        dedupe_key: `broadcast:${b.id}`,
        payload: {
          title: b.title,
          body: b.body,
          link_url: b.link_url ?? null,
          link_label: b.link_label ?? null,
          recipient_email: u.email,
        } as Record<string, unknown>,
      }));

      if (queueRows.length > 0) {
        const { error: insertError } = await supabase
          .from("notification_queue")
          .insert(queueRows);
        if (insertError) throw new Error(insertError.message);
      }

      await supabase
        .from("broadcast_announcements")
        .update({ email_fanout_completed_at: new Date().toISOString() })
        .eq("id", b.id);

      result.total_emails_queued += queueRows.length;
      result.details.push({
        broadcast_id: b.id as string,
        audience: b.audience as string,
        emails_queued: queueRows.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.details.push({
        broadcast_id: b.id as string,
        audience: b.audience as string,
        emails_queued: 0,
        error: msg,
      });
    }
  }

  return result;
}

type Recipient = { user_id: string; email: string };

async function loadAudience(
  supabase: ReturnType<typeof createAdminClient>,
  audience: string,
): Promise<Recipient[]> {
  const roleFilter: string | null =
    audience === "all"
      ? null
      : audience === "hosts"
        ? "host"
        : audience === "guests"
          ? "guest"
          : audience === "staff"
            ? "staff"
            : audience === "super_admins"
              ? "super_admin"
              : null;

  let q = supabase
    .from("user_profiles")
    .select("id, email")
    .eq("is_active", true)
    .is("deleted_at", null)
    .not("email", "is", null);
  if (roleFilter) q = q.eq("role", roleFilter);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter(
      (r) => typeof r.email === "string" && (r.email as string).includes("@"),
    )
    .map((r) => ({ user_id: r.id as string, email: r.email as string }));
}
