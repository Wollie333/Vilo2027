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

function matchesSecret(
  rawBody: string,
  signature: string,
  secret: string | null | undefined,
): boolean {
  if (!secret) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}

// Verify against the env key (bookings) OR the admin-configured platform key
// (subscriptions/products), since Wielo's own merchant key may be set in DB.
// deno-lint-ignore no-explicit-any
async function verifySignature(
  rawBody: string,
  signature: string | null,
  supabase: any,
): Promise<boolean> {
  if (!signature) return false;
  if (matchesSecret(rawBody, signature, env.get("PAYSTACK_SECRET_KEY"))) {
    return true;
  }
  try {
    const { data } = await supabase
      .from("platform_payment_settings")
      .select("paystack_secret_key, paystack_test_secret_key")
      .eq("id", true)
      .maybeSingle();
    // Try both live and test secrets so webhooks verify in either mode.
    return (
      matchesSecret(rawBody, signature, data?.paystack_secret_key) ||
      matchesSecret(rawBody, signature, data?.paystack_test_secret_key)
    );
  } catch {
    return false;
  }
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

  const supabase = adminClient();
  if (!(await verifySignature(rawBody, signature, supabase))) {
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

  // ─── Wielo subscription billing branch ──────────────────────────────
  // Wielo's own revenue (host pays for a plan on the PLATFORM key) is keyed by
  // platform_ledger.provider_reference, NOT payments. Discriminate on the
  // metadata purpose so the booking path below stays byte-identical.
  const purpose = (event.data?.metadata as { purpose?: string } | null)
    ?.purpose;
  if (purpose === "subscription" || purpose === "service") {
    await processSubscriptionEvent(event, supabase);
    return;
  }
  if (purpose === "product") {
    await processProductEvent(event, supabase);
    return;
  }

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
        .eq("status", "completed")
        // Exclude voided rows — they keep status 'completed' but are not paid
        // (matches lib/payments/ledger.ts, the single source of truth).
        .is("voided_at", null),
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

// Resolve the completed platform_ledger charge by reference and accrue affiliate
// commission. Idempotent (the RPC no-ops on replays and unreferred payers).
// deno-lint-ignore no-explicit-any
async function accrueCommissionByReference(supabase: any, ref: string) {
  try {
    const { data: led } = await supabase
      .from("platform_ledger")
      .select("id")
      .eq("provider_reference", ref)
      .maybeSingle();
    if (led?.id) {
      await supabase.rpc("accrue_affiliate_commission", {
        p_ledger_id: led.id,
      });
    }
  } catch {
    // Commission accrual must never break payment settlement.
  }
}

// ─── Wielo product order handler ───────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function processProductEvent(event: PaystackEvent, supabase: any) {
  if (event.event !== "charge.success") return;
  const ref = event.data.reference;
  const { data: order } = await supabase
    .from("product_orders")
    .select(
      "id, product_id, payer_user_id, amount, setup_fee_amount, currency, status, environment, activate_on_pay",
    )
    .eq("provider_reference", ref)
    .maybeSingle();
  if (!order || order.status === "paid") return;

  const now = new Date().toISOString();
  const environment = order.environment ?? "live";
  await supabase
    .from("product_orders")
    .update({ status: "paid", paid_at: now, method: "paystack" })
    .eq("id", order.id);

  // A pending platform_ledger row is seeded at checkout init — flip it to
  // completed. Insert only if it's missing (idempotent on provider_reference).
  const { data: led } = await supabase
    .from("platform_ledger")
    .select("id, status")
    .eq("provider_reference", ref)
    .maybeSingle();
  if (led) {
    if (led.status !== "completed") {
      await supabase
        .from("platform_ledger")
        .update({ status: "completed", paid_at: now, environment })
        .eq("id", led.id);
    }
  } else {
    await supabase.from("platform_ledger").insert({
      user_id: order.payer_user_id,
      product_id: order.product_id,
      type: "charge",
      status: "completed",
      amount: Number(order.amount),
      setup_fee_amount: Number(order.setup_fee_amount ?? 0),
      currency: order.currency,
      provider: "paystack",
      provider_reference: ref,
      environment,
      paid_at: now,
      reason: "Product purchase",
    });
  }

  // Accrue affiliate commission if the payer was referred (idempotent in the RPC).
  await accrueCommissionByReference(supabase, ref);

  // If the buyer purchased ANY subscription product, activate it on their
  // subscription. The PRODUCT is authoritative for gating/scopes, recorded on
  // subscriptions.product_id (check_feature_permission resolves features from
  // product_features). `plan` is kept a valid plans.key for legacy reads:
  // derived from the product slug when that slug is a real plan, else the host's
  // current plan is preserved. Mirrors the TS confirm path (activateMappedPlan)
  // and admin setUserProductAction. Only when the buyer has a Wielo account +
  // host (the buy-first flow sets this at signup instead). A custom-amount
  // top-up order (activate_on_pay=false, e.g. a pro-rated upgrade delta) only
  // collects money — the tier was activated at admin time, so never re-activate.
  if (
    order.payer_user_id &&
    order.product_id &&
    order.activate_on_pay !== false
  ) {
    const { data: product } = await supabase
      .from("products")
      .select("product_type, slug, billing_cycle, plan_key")
      .eq("id", order.product_id)
      .maybeSingle();
    // Multi-subscription: membership | service become subscriptions (once-off
    // `product` lives in product_orders only). A host holds one membership + N
    // services, so key the row by (host_id, product_id) — never one-per-host.
    if (product && product.product_type !== "product") {
      const isMembership = product.product_type === "membership";
      const { data: host } = await supabase
        .from("hosts")
        .select("id")
        .eq("user_id", order.payer_user_id)
        .maybeSingle();
      if (host) {
        const cycle = product.billing_cycle === "annual" ? "annual" : "monthly";
        const periodEnd = addMonths(new Date(), cycle === "annual" ? 12 : 1);
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, plan")
          .eq("host_id", host.id)
          .eq("product_id", order.product_id)
          .maybeSingle();

        // Keep `plan` a valid plans.key (FK): the product's plan_key/slug only
        // if it matches a plan, else preserve the current plan (or 'free').
        let plan = sub?.plan ?? "free";
        const desiredKey = product.plan_key ?? product.slug;
        if (desiredKey) {
          const { data: planRow } = await supabase
            .from("plans")
            .select("key")
            .eq("key", desiredKey)
            .maybeSingle();
          if (planRow) plan = planRow.key;
        }

        const patch = {
          product_id: order.product_id,
          plan,
          billing_cycle: cycle,
          status: "active",
          current_period_start: now,
          current_period_end: periodEnd,
        };
        if (sub) {
          await supabase.from("subscriptions").update(patch).eq("id", sub.id);
        } else {
          // A NEW membership: retire any other active membership first so the
          // one-per-host trigger doesn't reject the insert.
          if (isMembership) {
            await retireOtherMemberships(supabase, host.id, order.product_id);
          }
          await supabase
            .from("subscriptions")
            .insert({ host_id: host.id, ...patch });
        }
      }
    }
  }
}

// Find the subscription a membership billing event applies to. Prefer the
// (host_id, product_id) row; else fall back to the host's membership-type
// subscription; else the first row. Avoids maybeSingle() throwing when a host
// holds several subscriptions.
// deno-lint-ignore no-explicit-any
async function findHostSubscription(
  supabase: any,
  hostId: string,
  productId: string | null,
) {
  if (productId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, failed_payment_count")
      .eq("host_id", hostId)
      .eq("product_id", productId)
      .maybeSingle();
    if (data) return data;
  }
  const { data: rows } = await supabase
    .from("subscriptions")
    .select("id, failed_payment_count, product_id")
    .eq("host_id", hostId);
  if (!rows || rows.length === 0) return null;
  // deno-lint-ignore no-explicit-any
  const pids = rows
    .map((r: any) => r.product_id)
    .filter((x: string | null) => !!x);
  if (pids.length) {
    const { data: mems } = await supabase
      .from("products")
      .select("id")
      .in("id", pids)
      .eq("product_type", "membership");
    // deno-lint-ignore no-explicit-any
    const memIds = new Set((mems ?? []).map((m: any) => m.id));
    // deno-lint-ignore no-explicit-any
    const found = rows.find(
      (r: any) => r.product_id && memIds.has(r.product_id),
    );
    if (found) return found;
  }
  return rows[0];
}

// Retire any active membership OTHER than keepProductId so a membership switch
// satisfies the one-active-membership-per-host DB trigger. Mirrors the TS
// activateMappedPlan / admin retireOtherMemberships.
// deno-lint-ignore no-explicit-any
async function retireOtherMemberships(
  supabase: any,
  hostId: string,
  keepProductId: string,
) {
  const { data: active } = await supabase
    .from("subscriptions")
    .select("id, product_id")
    .eq("host_id", hostId)
    .in("status", ["trialing", "active", "past_due"]);
  const pids = (active ?? [])
    // deno-lint-ignore no-explicit-any
    .map((s: any) => s.product_id)
    .filter((x: string | null) => !!x && x !== keepProductId);
  if (!pids.length) return;
  const { data: mem } = await supabase
    .from("products")
    .select("id")
    .in("id", pids)
    .eq("product_type", "membership");
  // deno-lint-ignore no-explicit-any
  const memIds = new Set((mem ?? []).map((p: any) => p.id));
  const retire = (active ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((s: any) => s.product_id && memIds.has(s.product_id))
    // deno-lint-ignore no-explicit-any
    .map((s: any) => s.id);
  if (retire.length) {
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", retire);
  }
}

// ─── Wielo subscription billing handler ────────────────────────────────
// Writes the Wielo revenue ledger + activates the host's subscription. Idempotent
// on platform_ledger.provider_reference (UNIQUE). Handles both the first checkout
// (a pending ledger row exists) and auto-renewals (no row yet → insert one).
function addMonths(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString();
}

// deno-lint-ignore no-explicit-any
async function processSubscriptionEvent(event: PaystackEvent, supabase: any) {
  const ref = event.data.reference;
  const meta = (event.data.metadata ?? {}) as Record<string, string>;
  const hostId = meta.host_id ?? null;
  const userId = meta.user_id ?? null;
  const plan = meta.plan ?? null;
  const cycle = meta.cycle === "annual" ? "annual" : "monthly";
  const environment = meta.environment === "test" ? "test" : "live";
  const amount = Number(event.data.amount ?? 0) / 100;
  const currency = event.data.currency ?? "ZAR";
  const now = new Date();

  // Existing ledger row (first checkout) if any.
  const { data: row } = await supabase
    .from("platform_ledger")
    .select("id, status")
    .eq("provider_reference", ref)
    .maybeSingle();

  // Native Paystack subscription billing is the MEMBERSHIP plan. Resolve the
  // product behind `plan` (its slug), then scope the subscription row by
  // (host_id, product_id) — a host may now hold several subscriptions, so we
  // must not assume one row per host.
  let productId: string | null = null;
  if (plan) {
    const { data: prod } = await supabase
      .from("products")
      .select("id")
      .eq("slug", plan)
      .in("product_type", ["membership", "service"])
      .maybeSingle();
    productId = prod?.id ?? null;
  }
  const sub = hostId
    ? await findHostSubscription(supabase, hostId, productId)
    : null;

  if (event.event === "charge.success") {
    // Idempotency: already completed → nothing to do.
    if (row && row.status === "completed") return;

    if (row) {
      await supabase
        .from("platform_ledger")
        .update({
          status: "completed",
          paid_at: now.toISOString(),
          period_start: now.toISOString(),
          period_end: addMonths(now, cycle === "annual" ? 12 : 1),
        })
        .eq("id", row.id);
    } else {
      // Auto-renewal (no pre-created row) — record it.
      await supabase.from("platform_ledger").insert({
        user_id: userId,
        host_id: hostId,
        subscription_id: sub?.id ?? null,
        plan,
        billing_cycle: cycle,
        type: "charge",
        status: "completed",
        amount,
        currency,
        provider: "paystack",
        provider_reference: ref,
        environment,
        paid_at: now.toISOString(),
        period_start: now.toISOString(),
        period_end: addMonths(now, cycle === "annual" ? 12 : 1),
        reason: "Subscription renewal",
      });
    }

    if (sub) {
      // `productId` (resolved above) is the product behind this plan, so gating
      // resolves from product_features and the admin sees the active product.
      await supabase
        .from("subscriptions")
        .update({
          plan: plan ?? undefined,
          product_id: productId ?? undefined,
          billing_cycle: cycle,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: addMonths(now, cycle === "annual" ? 12 : 1),
          failed_payment_count: 0,
          grace_period_ends_at: null,
          cancel_at_period_end: false,
          cancelled_at: null,
          cancellation_reason: null,
        })
        .eq("id", sub.id);

      await supabase.from("subscription_history").insert({
        subscription_id: sub.id,
        host_id: hostId,
        event: "subscription_charged",
        to_plan: plan,
        to_status: "active",
        amount_charged: amount,
        currency,
        notes: "Paystack charge",
      });
    }

    // Accrue affiliate commission if the payer was referred (idempotent in the RPC).
    await accrueCommissionByReference(supabase, ref);
    return;
  }

  if (event.event === "charge.failed") {
    if (row && row.status === "pending") {
      await supabase
        .from("platform_ledger")
        .update({ status: "failed" })
        .eq("id", row.id);
    }
    if (sub) {
      const fails = Number(sub.failed_payment_count ?? 0) + 1;
      // 5-day grace before the account is restricted (see subscriptions schema).
      const graceEnds = new Date(now.getTime() + 5 * 86_400_000).toISOString();
      await supabase
        .from("subscriptions")
        .update({
          status: "past_due",
          failed_payment_count: fails,
          grace_period_ends_at: graceEnds,
        })
        .eq("id", sub.id);
    }
    return;
  }
}
