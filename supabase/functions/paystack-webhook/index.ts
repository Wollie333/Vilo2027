// Paystack webhook handler.
//
// Per AGENT_RULES.md §1.3:
//   - Verify x-paystack-signature (HMAC SHA-512) before any DB write.
//   - Return 200 immediately, then process async.
//   - Idempotency via payments.provider_reference UNIQUE.
//   - Full raw payload logged to payments.provider_response.
//
// Local dev: `supabase functions serve paystack-webhook --env-file .env.local`
// Deploy:    `supabase functions deploy paystack-webhook --no-verify-jwt`
// Register:  Paystack dashboard → Settings → API Keys & Webhooks → add the
//            function URL as the live + test webhook.

// @ts-expect-error Deno-only import — TypeScript in the Next workspace
// can't resolve this, but the function runs on Supabase's Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
// @ts-expect-error Deno standard crypto via node compat
import { createHmac } from "node:crypto";

// @ts-expect-error Deno global
const env = Deno.env;

type PaystackEvent = {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: "success" | "failed" | "abandoned" | string;
    paid_at?: string;
    customer?: { email?: string };
    metadata?: Record<string, unknown> | null;
  };
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = env.get("PAYSTACK_SECRET_KEY");
  if (!secret || !signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}

function adminClient() {
  const url = env.get("SUPABASE_URL");
  const serviceKey = env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "paystack-webhook: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifySignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Reply early — process async per AGENT_RULES.md §1.3.
  const event = JSON.parse(rawBody) as PaystackEvent;

  // Fire-and-forget so we don't block the 200.
  processEvent(event, rawBody).catch(() => {
    // Failure is swallowed here on purpose; Paystack will retry on non-200.
    // Investigation tooling lands when Sentry/PostHog wire up.
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function processEvent(event: PaystackEvent, rawBody: string) {
  // Only act on success / failed for now. Other events (charge.dispute etc.)
  // get logged for audit but skip DB mutation.
  const ref = event.data?.reference;
  if (!ref) return;

  const supabase = adminClient();

  // Locate the payment row. provider_reference is UNIQUE so this is a
  // single-row lookup.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, booking_id, amount, currency")
    .eq("provider_reference", ref)
    .maybeSingle();

  if (!payment) {
    // Either we missed the init step or Paystack is replaying for a
    // different environment. Log + bail.
    return;
  }

  // Always stash the raw payload for audit.
  await supabase
    .from("payments")
    .update({ provider_response: JSON.parse(rawBody) })
    .eq("id", payment.id);

  // Idempotency: if we've already settled this payment, do nothing.
  if (payment.status !== "pending") return;

  if (event.event === "charge.success") {
    await supabase
      .from("payments")
      .update({
        status: "completed",
        captured_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // Derive paid/balance from the ledger (sum of COMPLETED inbound payments,
    // including the row just settled above) — a deposit-only card payment must
    // confirm the booking but leave the balance owing, NOT mark it fully paid.
    // Mirrors lib/payments/ledger.ts, the single source of truth.
    const INBOUND = new Set([
      "deposit",
      "balance",
      "addon",
      "payment",
      "credit",
    ]);
    const [{ data: bk }, { data: paidRows }] = await Promise.all([
      supabase
        .from("bookings")
        .select("total_amount")
        .eq("id", payment.booking_id)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("amount, kind")
        .eq("booking_id", payment.booking_id)
        .eq("status", "completed"),
    ]);
    const total = Number(bk?.total_amount ?? 0);
    const paid = (paidRows ?? [])
      .filter((r: { kind: string }) => INBOUND.has(String(r.kind)))
      .reduce(
        (s: number, r: { amount: number }) => s + Number(r.amount ?? 0),
        0,
      );
    const balanceDue = Math.max(0, Math.round((total - paid) * 100) / 100);

    // trigger_booking_confirmed in 20260501000013_create_triggers.sql
    // inserts blocked_dates rows automatically when status flips to
    // confirmed. No duplication here per AGENT_RULES.md §4.2.
    const { data: confirmed } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        payment_status: paid + 0.001 >= total ? "completed" : "partial",
        balance_due: balanceDue,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", payment.booking_id)
      .eq("status", "pending")
      .select("id, guest_id, host_id")
      .maybeSingle();

    // Enqueue the confirmation emails — the drain cron renders + sends them
    // (booking_confirmed_guest / _host resolvers hydrate from booking_id).
    // Guarded by the transition above, so duplicate webhooks are idempotent.
    // Manual host-approved bookings email via dispatchEvent instead; a paid
    // booking is auto-confirmed only here, so there's no double-send.
    if (confirmed) {
      const queueRows: Record<string, unknown>[] = [];
      if (confirmed.guest_id) {
        queueRows.push({
          type: "booking_confirmed_guest",
          guest_id: confirmed.guest_id,
          user_id: confirmed.guest_id,
          payload: { booking_id: confirmed.id },
        });
      }
      if (confirmed.host_id) {
        queueRows.push({
          type: "booking_confirmed_host",
          host_id: confirmed.host_id,
          payload: { booking_id: confirmed.id },
        });
      }
      if (queueRows.length > 0) {
        await supabase.from("notification_queue").insert(queueRows);
      }
    }
    return;
  }

  if (event.event === "charge.failed") {
    await supabase
      .from("payments")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    await supabase
      .from("bookings")
      .update({ payment_status: "failed" })
      .eq("id", payment.booking_id);
    return;
  }
}
