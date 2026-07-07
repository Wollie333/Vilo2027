import { NextResponse } from "next/server";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 100;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Shares EMAIL_WORKER_SECRET with the other queue workers (one bearer, several
// workers — see notification_system_cron migration).
function authorised(req: Request): boolean {
  const expected = process.env.EMAIL_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

type ReminderRow = {
  id: string;
  host_id: string | null;
  guest_name: string | null;
  check_in: string | null;
  listing: { name: string | null } | { name: string | null }[] | null;
};

/**
 * Dispatches the `check_in_reminder_host` push + in-app notification for every
 * CONFIRMED booking that checks in tomorrow. Registered in the registry with a
 * dedupeKey (`checkin_host:<booking_id>`), which already de-dupes the push +
 * email channels — but in-app is NOT de-duped by dispatch, so this worker is
 * the idempotency gate: it skips any booking that already has a
 * notification_delivery_log row for that key. Pinged by the
 * drain-checkin-reminders pg_cron.
 */
export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    // "Tomorrow" as a plain date (check_in is date-only). One day's lead time.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: rows, error } = await admin
      .from("bookings")
      .select("id, host_id, guest_name, check_in, listing:properties ( name )")
      .eq("status", "confirmed")
      .eq("check_in", tomorrow)
      .is("deleted_at", null)
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    let sent = 0;
    let skipped = 0;
    for (const b of (rows ?? []) as ReminderRow[]) {
      if (!b.host_id) {
        skipped += 1;
        continue;
      }
      // Resolve the host's auth user (the notification recipient).
      const { data: host } = await admin
        .from("hosts")
        .select("user_id")
        .eq("id", b.host_id)
        .maybeSingle();
      const userId = (host as { user_id: string | null } | null)?.user_id;
      if (!userId) {
        skipped += 1;
        continue;
      }

      // Idempotency: dispatch logs a delivery row per channel keyed by
      // dedupe_key — if one already exists we've reminded this host already.
      const dedupeKey = `checkin_host:${b.id}`;
      const { data: prior } = await admin
        .from("notification_delivery_log")
        .select("id")
        .eq("user_id", userId)
        .eq("dedupe_key", dedupeKey)
        .limit(1);
      if (prior && prior.length > 0) {
        skipped += 1;
        continue;
      }

      const listing = Array.isArray(b.listing) ? b.listing[0] : b.listing;
      const listingName = listing?.name ?? null;
      const guestFirst = (b.guest_name ?? "").trim().split(/\s+/)[0] || null;

      await dispatchEvent({
        kind: "check_in_reminder_host",
        recipientUserId: userId,
        hostId: b.host_id,
        refs: {
          booking_id: b.id,
          ...(guestFirst ? { guest_first_name: guestFirst } : {}),
          ...(listingName ? { listing_name: listingName } : {}),
        },
        supabase: admin,
      });
      sent += 1;
    }

    return NextResponse.json({
      success: true,
      data: { processed: rows?.length ?? 0, sent, skipped },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "CHECKIN_REMINDER_WORKER_FAILED", message },
      },
      { status: 500 },
    );
  }
}
