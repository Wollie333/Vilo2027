import { createAdminClient } from "@/lib/supabase/admin";

import {
  getEvent,
  isRegisteredEvent,
  type EventKind,
  type RefsFor,
} from "./registry";
import type { EffectivePrefs, PushPayload, UserSettings } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// dispatchEvent — single entry point for every notification.
//
// Edge Functions / server actions / webhooks / cron drains all funnel
// through here. The function MUST NOT THROW: a failed dispatch must never
// break the caller's main flow.
//
// Flow per plan v2 §"Code — central dispatcher":
//   1. Lookup event in registry; unknown kind → log + return.
//   2. Resolve effective prefs via resolve_notification_prefs RPC
//      (handles locked-override + role-default fallback).
//   3. Quiet hours — defer non-critical push to pending_push_queue.
//   4. Digest — for supports_digest categories with digest_mode != off,
//      route info/default events to pending_digest_items (in-app + email);
//      push always goes immediately or quiet-deferred.
//   5. Dedup — skip email if push for same dedupe_key was delivered+read
//      in the last 5 min; skip push if a previous push for the same key
//      already fired in the same window.
//   6. Email — INSERT THIN row into notification_queue (payload = refs);
//      drain.ts auto-hydrates via apps/web/lib/email/resolvers/*.
//   7. Push — INSERT into pending_push_queue (full builder output, with
//      release_at honoring quiet hours).
//   8. In-app — call enqueue_in_app_notification RPC with category + severity.
//   9. Log each dispatched channel to notification_delivery_log.
// ──────────────────────────────────────────────────────────────────────────

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const CATEGORIES_SUPPORTING_DIGEST = new Set(["reviews", "marketing_tips"]);

type AdminClient = ReturnType<typeof createAdminClient>;

export type DispatchInput<K extends EventKind> = {
  kind: K;
  recipientUserId: string;
  refs: RefsFor<K>;
  /** For email recipient resolution via the hosts table. */
  hostId?: string;
  /** For email recipient resolution via user_profiles. */
  guestId?: string;
  /** Override the registry's default dedupe key. */
  dedupeKey?: string | null;
  /** Force-enable a subset of channels (admin individual sends use this). */
  overrideChannels?: { email?: boolean; push?: boolean; in_app?: boolean };
  /** Inject a pre-built admin client (tests / batch flows). */
  supabase?: AdminClient;
};

export async function dispatchEvent<K extends EventKind>(
  input: DispatchInput<K>,
): Promise<void> {
  try {
    await dispatchEventInner(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notifications] dispatch failed: ${input.kind} → ${msg}`);
  }
}

async function dispatchEventInner<K extends EventKind>(
  input: DispatchInput<K>,
): Promise<void> {
  if (!isRegisteredEvent(input.kind)) {
    console.warn(`[notifications] unknown event kind: ${input.kind}`);
    return;
  }
  // getEvent erases the narrow object-literal type so optional fields
  // (emailTemplate / push / inApp / dedupeKey) are always accessible.
  const event = getEvent(input.kind);

  const supabase = input.supabase ?? createAdminClient();
  const prefs = await resolvePrefs(
    supabase,
    input.recipientUserId,
    event.category,
  );
  const settings = await resolveSettings(supabase, input.recipientUserId);

  const dedupeKey =
    input.dedupeKey !== undefined
      ? input.dedupeKey
      : (event.dedupeKey?.(input.refs as never) ?? null);

  // ─── Digest routing (low-priority bundleable)
  if (
    event.severity !== "critical" &&
    event.severity !== "high" &&
    CATEGORIES_SUPPORTING_DIGEST.has(event.category) &&
    prefs.digest_mode !== "off" &&
    !prefs.is_locked
  ) {
    const ia = event.inApp?.(input.refs as never);
    if (ia) {
      await supabase.from("pending_digest_items").insert({
        user_id: input.recipientUserId,
        category_id: event.category,
        event_kind: input.kind,
        title: ia.title,
        body: ia.body ?? null,
        link: ia.link ?? null,
        payload: input.refs as Record<string, unknown>,
      });
    }
    return;
  }

  const override = input.overrideChannels;
  const channelEnabled = (ch: "email" | "push" | "in_app"): boolean => {
    if (override && override[ch] !== undefined) return override[ch] === true;
    if (prefs.is_locked) return true;
    if (ch === "email") return prefs.email_enabled;
    if (ch === "push") return prefs.push_enabled;
    return prefs.in_app_enabled;
  };

  // ─── Email
  if (event.emailTemplate && channelEnabled("email")) {
    const skip =
      settings.dedupe_enabled &&
      (await shouldSkipEmail(supabase, input.recipientUserId, dedupeKey));
    if (!skip) {
      await supabase.from("notification_queue").insert({
        type: event.emailTemplate,
        payload: input.refs as Record<string, unknown>,
        host_id: input.hostId ?? null,
        guest_id: input.guestId ?? null,
        user_id: input.recipientUserId,
        category_id: event.category,
        dedupe_key: dedupeKey,
      });
      await logDelivery(supabase, {
        user_id: input.recipientUserId,
        event_kind: input.kind,
        category_id: event.category,
        channel: "email",
        dedupe_key: dedupeKey,
      });
    }
  }

  // ─── Push
  const pushPayload = event.push?.(input.refs as never) ?? null;
  if (pushPayload && channelEnabled("push")) {
    const skip =
      settings.dedupe_enabled &&
      (await shouldSkipPush(supabase, input.recipientUserId, dedupeKey));
    if (!skip) {
      const releaseAt = computeQuietHoursRelease(settings, event.severity);
      await supabase.from("pending_push_queue").insert({
        user_id: input.recipientUserId,
        event_kind: input.kind,
        payload: pushPayload as unknown as Record<string, unknown>,
        release_at: releaseAt.toISOString(),
      });
      await logDelivery(supabase, {
        user_id: input.recipientUserId,
        event_kind: input.kind,
        category_id: event.category,
        channel: "push",
        dedupe_key: dedupeKey,
      });
    }
  }

  // ─── In-app
  const inAppPayload = event.inApp?.(input.refs as never) ?? null;
  if (inAppPayload && channelEnabled("in_app")) {
    await supabase.rpc("enqueue_in_app_notification", {
      p_user_id: input.recipientUserId,
      p_kind: input.kind,
      p_title: inAppPayload.title,
      p_body: inAppPayload.body ?? null,
      p_link: inAppPayload.link ?? null,
      p_payload: (input.refs as Record<string, unknown>) ?? {},
      p_category_id: event.category,
      p_severity: event.severity,
    });
    await logDelivery(supabase, {
      user_id: input.recipientUserId,
      event_kind: input.kind,
      category_id: event.category,
      channel: "in_app",
      dedupe_key: dedupeKey,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

async function resolvePrefs(
  supabase: AdminClient,
  userId: string,
  categoryId: string,
): Promise<EffectivePrefs> {
  const { data, error } = await supabase
    .rpc("resolve_notification_prefs", {
      p_user_id: userId,
      p_category_id: categoryId,
    })
    .single();
  if (error || !data) {
    return {
      email_enabled: true,
      push_enabled: true,
      in_app_enabled: true,
      digest_mode: "off",
      is_locked: false,
    };
  }
  return data as EffectivePrefs;
}

async function resolveSettings(
  supabase: AdminClient,
  userId: string,
): Promise<UserSettings> {
  const { data } = await supabase
    .from("user_notification_settings")
    .select(
      "quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, dedupe_enabled",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (
    (data as UserSettings | null) ?? {
      quiet_hours_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
      quiet_hours_timezone: "Africa/Johannesburg",
      dedupe_enabled: true,
    }
  );
}

function computeQuietHoursRelease(
  settings: UserSettings,
  severity: string,
): Date {
  if (
    severity === "critical" ||
    !settings.quiet_hours_enabled ||
    !settings.quiet_hours_start ||
    !settings.quiet_hours_end
  ) {
    return new Date();
  }

  const nowMin = currentMinutesInTimezone(settings.quiet_hours_timezone);
  const startMin = parseTimeToMinutes(settings.quiet_hours_start);
  const endMin = parseTimeToMinutes(settings.quiet_hours_end);

  if (!isInWindow(nowMin, startMin, endMin)) return new Date();

  const minutesUntilEnd =
    endMin > nowMin ? endMin - nowMin : 24 * 60 - nowMin + endMin;
  return new Date(Date.now() + minutesUntilEnd * 60 * 1000);
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function currentMinutesInTimezone(tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(
      parts.find((p) => p.type === "minute")?.value ?? "0",
      10,
    );
    return h * 60 + m;
  } catch {
    const d = new Date();
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

function isInWindow(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

async function shouldSkipEmail(
  supabase: AdminClient,
  userId: string,
  dedupeKey: string | null,
): Promise<boolean> {
  if (!dedupeKey) return false;
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("notification_delivery_log")
    .select("channel, read_at")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .gte("created_at", cutoff)
    .limit(20);
  if (!data) return false;
  return data.some((r) => r.channel === "push" && r.read_at !== null);
}

async function shouldSkipPush(
  supabase: AdminClient,
  userId: string,
  dedupeKey: string | null,
): Promise<boolean> {
  if (!dedupeKey) return false;
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("notification_delivery_log")
    .select("channel")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .eq("channel", "push")
    .gte("created_at", cutoff)
    .limit(1);
  return Boolean(data && data.length > 0);
}

type DeliveryLogInput = {
  user_id: string;
  event_kind: string;
  category_id: string;
  channel: "email" | "push" | "in_app";
  dedupe_key: string | null;
};

async function logDelivery(
  supabase: AdminClient,
  input: DeliveryLogInput,
): Promise<void> {
  await supabase.from("notification_delivery_log").insert(input);
}

// Suppress unused import warning when only the type is exported.
export type { PushPayload };
