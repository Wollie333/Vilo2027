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

type ReminderListing = { name: string | null; check_in_time: string | null };
type ReminderRow = {
  id: string;
  host_id: string | null;
  guest_id: string | null;
  guest_name: string | null;
  check_in: string | null;
  listing: ReminderListing | ReminderListing[] | null;
};

/** Has this exact (user, dedupe_key) reminder already been delivered? */
async function alreadyReminded(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  dedupeKey: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notification_delivery_log")
    .select("id")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .limit(1);
  return !!data && data.length > 0;
}

/**
 * For every CONFIRMED booking that checks in tomorrow, dispatches a push +
 * in-app reminder to BOTH the host (`check_in_reminder_host`) and the guest
 * (`check_in_reminder_guest`). Each side has its own registry dedupeKey
 * (`checkin_host:` / `checkin_guest:<booking_id>`) which de-dupes push + email,
 * but in-app is NOT de-duped by dispatch — so this worker is the idempotency
 * gate: it skips a side that already has a notification_delivery_log row for
 * its key. Pinged by the drain-checkin-reminders pg_cron.
 *
 * (Separate from the ~1h-before access card + stay-details email, which the
 * send_due_access_cards() SQL cron handles — this is the day-before nudge.)
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
      .select(
        "id, host_id, guest_id, guest_name, check_in, listing:properties ( name, check_in_time )",
      )
      .eq("status", "confirmed")
      .eq("check_in", tomorrow)
      .is("deleted_at", null)
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    let sentHost = 0;
    let sentGuest = 0;
    let skipped = 0;
    for (const b of (rows ?? []) as ReminderRow[]) {
      const listing = Array.isArray(b.listing) ? b.listing[0] : b.listing;
      const listingName = listing?.name ?? null;
      const checkInTime =
        typeof listing?.check_in_time === "string"
          ? listing.check_in_time.slice(0, 5)
          : null;
      const guestFirst = (b.guest_name ?? "").trim().split(/\s+/)[0] || null;

      // ── Host reminder ──
      if (b.host_id) {
        const { data: host } = await admin
          .from("hosts")
          .select("user_id")
          .eq("id", b.host_id)
          .maybeSingle();
        const hostUserId = (host as { user_id: string | null } | null)?.user_id;
        if (hostUserId) {
          if (
            await alreadyReminded(admin, hostUserId, `checkin_host:${b.id}`)
          ) {
            skipped += 1;
          } else {
            await dispatchEvent({
              kind: "check_in_reminder_host",
              recipientUserId: hostUserId,
              hostId: b.host_id,
              refs: {
                booking_id: b.id,
                ...(guestFirst ? { guest_first_name: guestFirst } : {}),
                ...(listingName ? { listing_name: listingName } : {}),
                ...(checkInTime ? { check_in_time: checkInTime } : {}),
              },
              supabase: admin,
            });
            sentHost += 1;
          }
        }
      }

      // ── Guest reminder (the day-before "check-in tomorrow" nudge) ──
      if (b.guest_id) {
        if (await alreadyReminded(admin, b.guest_id, `checkin_guest:${b.id}`)) {
          skipped += 1;
        } else {
          await dispatchEvent({
            kind: "check_in_reminder_guest",
            recipientUserId: b.guest_id,
            guestId: b.guest_id,
            refs: {
              booking_id: b.id,
              ...(listingName ? { listing_name: listingName } : {}),
              ...(checkInTime ? { check_in_time: checkInTime } : {}),
            },
            supabase: admin,
          });
          sentGuest += 1;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: rows?.length ?? 0,
        sentHost,
        sentGuest,
        skipped,
      },
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
