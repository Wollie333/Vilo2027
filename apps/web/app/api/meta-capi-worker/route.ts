import { NextResponse } from "next/server";

import { sendCapiEvent } from "@/lib/integrations/meta-capi";
import { splitName } from "@/lib/profile/name";
import { createAdminClient } from "@/lib/supabase/admin";

// Meta Conversions API drain worker. Pinged each minute by the drain-meta-capi
// pg_cron (20260801160000). For every PENDING row in meta_conversion_events it
// hashes the payer's PII (server-only) and POSTs one event to Meta, then stamps
// a terminal/retry status. Mirrors the nurture-worker: same shared
// EMAIL_WORKER_SECRET bearer, batch drain, best-effort.
//
// PII matching is POPIA-gated: a lead without marketing_consent is sent with
// Meta Limited Data Use (no hashed PII). A settled customer with no CRM card
// (converts-with-no-card) is treated as consenting — legitimate conversion
// measurement.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorised(req: Request): boolean {
  const expected = process.env.EMAIL_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();

    const { data: rows, error } = await admin
      .from("meta_conversion_events")
      .select(
        "id, event_name, event_id, user_id, lead_id, value, currency, content_ids, content_name, action_source, attempts, user_profiles(email, full_name, phone), pipeline_leads(marketing_consent)",
      )
      .eq("status", "pending")
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows ?? []) {
      const prof = row.user_profiles as {
        email?: string | null;
        full_name?: string | null;
        phone?: string | null;
      } | null;
      const card = row.pipeline_leads as {
        marketing_consent?: boolean | null;
      } | null;
      // No card → a direct customer (settled/registered): consent implied.
      const consent = card ? Boolean(card.marketing_consent) : true;
      const { first_name, surname } = splitName(prof?.full_name);

      const result = await sendCapiEvent({
        eventName: row.event_name,
        eventId: row.event_id,
        actionSource:
          row.action_source === "website" ? "website" : "system_generated",
        email: prof?.email ?? null,
        phone: prof?.phone ?? null,
        firstName: first_name || null,
        lastName: surname || null,
        externalId: row.user_id ?? null,
        value: row.value,
        currency: row.currency,
        contentIds: (row.content_ids as string[] | null) ?? [],
        contentName: row.content_name ?? null,
        limitedDataUse: !consent,
      });

      if (!result.configured) {
        // CAPI not set up/enabled — don't retry forever.
        await admin
          .from("meta_conversion_events")
          .update({ status: "skipped", last_error: "CAPI not configured" })
          .eq("id", row.id);
        skipped += 1;
      } else if (result.ok) {
        await admin
          .from("meta_conversion_events")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
            response: { status: result.status ?? null },
          })
          .eq("id", row.id);
        sent += 1;
      } else {
        const attempts = (row.attempts ?? 0) + 1;
        await admin
          .from("meta_conversion_events")
          .update({
            status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts,
            last_error: result.error ?? `Meta returned ${result.status ?? "?"}`,
          })
          .eq("id", row.id);
        failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: { processed: rows?.length ?? 0, sent, failed, skipped },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { code: "META_CAPI_WORKER_FAILED", message } },
      { status: 500 },
    );
  }
}
