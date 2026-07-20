// Paystack webhook handler.
//
// Per AGENT_RULES.md §1.3:
//   - Verify x-paystack-signature (HMAC SHA-512) before any DB write.
//   - Idempotency via payments.provider_reference UNIQUE.
//   - Full raw payload logged to payments.provider_response.
//
// Note on §1.3's "return 200, process async": there is no webhook queue, so
// fire-and-forget would lose an event on any transient failure. Instead we
// process synchronously (fast + idempotent) and return 500 on failure so
// Paystack's own retry is the durability mechanism — the rule's intent
// (never time out) still holds because processing is a few indexed writes.
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
    customer?: { email?: string; customer_code?: string };
    // Present on charge.success. When `reusable`, we capture authorization_code
    // (encrypted) so the renewal worker can re-charge the card each cycle.
    authorization?: {
      authorization_code?: string;
      last4?: string;
      exp_month?: string;
      exp_year?: string;
      card_type?: string;
      brand?: string;
      reusable?: boolean;
    };
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

// Decrypt a payment secret stored by the app (lib/crypto/payments.ts): format
// `v1.<nonce_b64>.<ct_b64>.<tag_b64>`, AES-256-GCM, key = PAYMENT_CIPHER_KEY
// (base64 → 32 bytes). A plaintext value (not in that format) passes through
// unchanged, so legacy plaintext keys keep verifying. Requires PAYMENT_CIPHER_KEY
// to be set as a function secret once the app starts encrypting Paystack keys.
async function decryptSecret(
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored) return null;
  const parts = stored.split(".");
  if (!(parts.length === 4 && parts[0] === "v1")) return stored; // plaintext
  const rawKey = env.get("PAYMENT_CIPHER_KEY");
  if (!rawKey) return null; // encrypted but no key here → cannot verify
  try {
    const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const keyBytes = b64(rawKey);
    if (keyBytes.length !== 32) return null;
    const nonce = b64(parts[1]);
    const ct = b64(parts[2]);
    const tag = b64(parts[3]);
    const combined = new Uint8Array(ct.length + tag.length);
    combined.set(ct);
    combined.set(tag, ct.length);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      key,
      combined,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// Encrypt a value with the SAME AES-256-GCM scheme the app uses
// (lib/crypto/payments.ts): output `v1.<nonce_b64>.<ct_b64>.<tag_b64>`, key =
// PAYMENT_CIPHER_KEY (base64 → 32 bytes). When the key is unset we passthrough
// plaintext (matches the app's optional-encryption contract; decryptSecret reads
// both). Used to store the reusable Paystack authorization_code at rest. Returns
// null only on a real crypto error (bad key length) so the caller can skip the
// write rather than store a broken token.
async function encryptSecret(plain: string): Promise<string | null> {
  const rawKey = env.get("PAYMENT_CIPHER_KEY");
  if (!rawKey) return plain; // passthrough when encryption is off
  try {
    const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const keyBytes = b64(rawKey);
    if (keyBytes.length !== 32) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const combined = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce, tagLength: 128 },
        key,
        new TextEncoder().encode(plain),
      ),
    );
    // WebCrypto appends the 16-byte tag to the ciphertext; the app stores them
    // separately, so split before base64-encoding.
    const ct = combined.slice(0, combined.length - 16);
    const tag = combined.slice(combined.length - 16);
    const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
    return `v1.${toB64(nonce)}.${toB64(ct)}.${toB64(tag)}`;
  } catch {
    return null;
  }
}

// Verify the signature AND resolve the environment from the KEY THAT MATCHED —
// never trust event metadata for environment (R1). A native/renewal event may
// omit the metadata that carried `environment`, and defaulting to "live" would
// book test money as live revenue and make refunds ungateable. Returns the
// environment on a valid signature, or null when no configured key verifies it
// (→ 401). The env key (bookings) is tagged by its sk_live_/sk_test_ prefix; the
// platform keys are tagged by WHICH column matched (live secret vs test secret).
// deno-lint-ignore no-explicit-any
async function verifySignatureEnv(
  rawBody: string,
  signature: string | null,
  supabase: any,
): Promise<"live" | "test" | null> {
  if (!signature) return null;
  const envKey = env.get("PAYSTACK_SECRET_KEY");
  if (matchesSecret(rawBody, signature, envKey)) {
    return envKey?.startsWith("sk_live_") ? "live" : "test";
  }
  try {
    const { data } = await supabase
      .from("platform_payment_settings")
      .select("paystack_secret_key, paystack_test_secret_key")
      .eq("id", true)
      .maybeSingle();
    // Decrypt (plaintext passes through) then try live then test so webhooks
    // verify in either mode; the matching column IS the environment.
    const live = await decryptSecret(data?.paystack_secret_key);
    if (matchesSecret(rawBody, signature, live)) return "live";
    const test = await decryptSecret(data?.paystack_test_secret_key);
    if (matchesSecret(rawBody, signature, test)) return "test";
    return null;
  } catch {
    return null;
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
  const environment = await verifySignatureEnv(rawBody, signature, supabase);
  if (!environment) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody) as PaystackEvent;

  // Process synchronously and let the HTTP status drive Paystack's retry.
  //
  // The old code fired processEvent and returned 200 unconditionally with a
  // comment claiming "Paystack will retry on non-200" — but it NEVER returned
  // non-200, so a transient failure (a DB blip mid-settlement) silently lost
  // that event forever, with no queue to catch it. processEvent is fast (a
  // handful of indexed single-row writes) and idempotent (every settle guards on
  // status='pending', and the return-page verify already re-runs the same work),
  // so awaiting it is safe and, crucially, a 500 now makes Paystack redeliver.
  try {
    await processEvent(event, rawBody, environment);
  } catch (err) {
    console.error(
      "paystack-webhook: processEvent failed, asking for retry",
      err,
    );
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function processEvent(
  event: PaystackEvent,
  rawBody: string,
  environment: "live" | "test",
) {
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
    await processSubscriptionEvent(event, supabase, environment);
    return;
  }
  if (purpose === "product") {
    await processProductEvent(event, supabase, environment);
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
        .select("total_amount, payment_status")
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
    const fullyPaid = paid + 0.001 >= total;

    // 1. Update the booking's money state for EVERY settlement — including a
    //    balance payment that lands on an ALREADY-confirmed booking (the guest
    //    didn't return to the pay page). Gating this on status='pending' left
    //    such a booking showing 'partial' with a stale balance. Never clobber a
    //    terminal money state (refunded/voided/failed) the refund flow set —
    //    mirrors recomputeBookingPaymentState in lib/payments/ledger.ts.
    const TERMINAL = new Set([
      "refunded",
      "partially_refunded",
      "voided",
      "failed",
    ]);
    const moneyPatch: Record<string, unknown> = { balance_due: balanceDue };
    if (!TERMINAL.has(String(bk?.payment_status))) {
      moneyPatch.payment_status = fullyPaid ? "completed" : "partial";
    }
    await supabase
      .from("bookings")
      .update(moneyPatch)
      .eq("id", payment.booking_id);

    // 2. First-time confirmation (calendar block + invoice mint + emails).
    //    trigger_booking_confirmed in 20260501000013_create_triggers.sql
    //    inserts blocked_dates rows automatically when status flips to
    //    confirmed. No duplication here per AGENT_RULES.md §4.2.
    const { data: confirmed } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", payment.booking_id)
      .eq("status", "pending")
      .select("id, guest_id, host_id")
      .maybeSingle();

    // 3. Flip the booking invoice(s) issued → paid once fully settled — parity
    //    with the manual-EFT + card-return paths (markBookingInvoicesPaidIfSettled).
    //    A deposit-first booking whose balance lands via this webhook would
    //    otherwise leave an 'issued' invoice.
    if (fullyPaid) {
      await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("booking_id", payment.booking_id)
        .eq("status", "issued");
    }

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
async function processProductEvent(
  event: PaystackEvent,
  supabase: any,
  verifiedEnv: "live" | "test",
) {
  if (event.event !== "charge.success" && event.event !== "charge.failed") {
    return;
  }
  const ref = event.data.reference;
  const { data: order } = await supabase
    .from("product_orders")
    .select(
      "id, product_id, payer_user_id, amount, setup_fee_amount, currency, status, environment, activate_on_pay, coupon_id, discount_amount, billing_cycle",
    )
    .eq("provider_reference", ref)
    .maybeSingle();
  if (!order) return;

  // Failed/abandoned product charge — resolve the order + its pending revenue
  // row so neither lingers as unresolved 'pending' forever, and the host sees a
  // failed state (mirrors the subscription + booking branches).
  if (event.event === "charge.failed") {
    if (order.status !== "pending") return;
    await supabase
      .from("product_orders")
      .update({ status: "failed" })
      .eq("id", order.id)
      .eq("status", "pending");
    await supabase
      .from("platform_ledger")
      .update({ status: "failed" })
      .eq("provider_reference", ref)
      .neq("status", "completed");
    return;
  }

  if (order.status === "paid") return;

  const now = new Date().toISOString();
  // Prefer the environment stored at checkout init; else the VERIFIED webhook
  // environment (R1) — never a bare "live" default.
  const environment = order.environment ?? verifiedEnv;
  // Compare-and-set: only the path that flips pending→paid proceeds to activate,
  // so the webhook and the pay-page return can't both insert a service
  // subscription (no unique host_id+product_id constraint) → duplicate active
  // sub that breaks the host's future subscription reads.
  const { data: claimed } = await supabase
    .from("product_orders")
    .update({ status: "paid", paid_at: now, method: "paystack" })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) return;

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
      coupon_id: order.coupon_id ?? null,
      environment,
      paid_at: now,
      reason: "Product purchase",
    });
  }

  // Bank the Wielo promo redemption (idempotent per order, so this backstop and
  // the pay-page return path can both run without double-counting the code).
  if (order.coupon_id) {
    await supabase.rpc("redeem_platform_coupon", {
      p_coupon_id: order.coupon_id,
      p_order_id: order.id,
      p_user_id: order.payer_user_id,
      p_amount: Number(order.discount_amount ?? 0),
      p_currency: order.currency,
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
      .select(
        "product_type, slug, billing_cycle, plan_key, credit_quantity, credit_purpose, name",
      )
      .eq("id", order.product_id)
      .maybeSingle();

    // Credit package → top up the buyer's host wallet via the atomic + idempotent
    // RPC (backstop for the return-path grant). Never becomes a subscription.
    if (product && product.product_type === "wielo_credits") {
      const qty = Number(product.credit_quantity ?? 0);
      if (qty > 0) {
        const { data: creditHost } = await supabase
          .from("hosts")
          .select("id")
          .eq("user_id", order.payer_user_id)
          .is("deleted_at", null)
          .maybeSingle();
        if (creditHost?.id) {
          await supabase.rpc("apply_wielo_credit", {
            p_host_id: creditHost.id,
            p_purpose: (product.credit_purpose as string) || "quote",
            p_delta: qty,
            p_kind: "purchase",
            p_reason: `Purchased: ${product.name ?? "credit package"}`,
            p_ref_type: "product_order",
            p_ref_id: order.id,
          });
        }
      }
    }

    // Multi-subscription: membership | service become subscriptions (once-off
    // `product` + credit packages live in product_orders only). A host holds one
    // membership + N services, so key the row by (host_id, product_id).
    if (
      product &&
      product.product_type !== "product" &&
      product.product_type !== "wielo_credits"
    ) {
      const isMembership = product.product_type === "membership";
      const { data: host } = await supabase
        .from("hosts")
        .select("id")
        .eq("user_id", order.payer_user_id)
        .maybeSingle();
      if (host) {
        // The buyer's chosen cycle (recorded on the order) wins over the
        // product's base cycle, so an annual purchase of a monthly-default plan
        // still grants a full year.
        const cycle =
          order.billing_cycle === "annual" || order.billing_cycle === "monthly"
            ? order.billing_cycle
            : product.billing_cycle === "annual"
              ? "annual"
              : "monthly";
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

        // Capture the reusable card authorization so the renewal cron can
        // re-charge it each cycle (hybrid Paystack rail). The self-serve PRODUCT
        // purchase (PlanPicker → startProductCheckoutDirect, purpose:"product") is
        // the FIRST charge for a membership/service, so — like processSubscription
        // Event — grab the token here or a product-bought sub would never renew.
        const auth = event.data.authorization;
        const savedAuth: Record<string, unknown> = {};
        if (auth?.reusable && auth.authorization_code) {
          const cipher = await encryptSecret(auth.authorization_code);
          if (cipher) {
            savedAuth.paystack_authorization_code_cipher = cipher;
            savedAuth.paystack_card_last4 = auth.last4 ?? null;
            savedAuth.paystack_card_brand =
              auth.card_type ?? auth.brand ?? null;
            savedAuth.paystack_card_exp =
              auth.exp_month && auth.exp_year
                ? `${String(auth.exp_month).padStart(2, "0")}/${String(
                    auth.exp_year,
                  ).slice(-2)}`
                : null;
          }
        }
        const custCode = event.data.customer?.customer_code;
        if (custCode) savedAuth.paystack_customer_code = custCode;

        const patch = {
          product_id: order.product_id,
          plan,
          billing_cycle: cycle,
          status: "active",
          current_period_start: now,
          current_period_end: periodEnd,
          ...savedAuth,
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

        // Grant this plan's recurring credit allotment for the period (idempotent
        // per product+period via apply_wielo_credit). Mirrors activateMappedPlan.
        const grantQty = Number(product.credit_quantity ?? 0);
        if (grantQty > 0) {
          await supabase.rpc("apply_wielo_credit", {
            p_host_id: host.id,
            p_purpose: (product.credit_purpose as string) || "quote",
            p_delta: grantQty,
            p_kind: "grant",
            p_reason: `Plan credits · ${product.name ?? "subscription"}`,
            p_ref_type: "subscription",
            p_ref_id: `${order.product_id}:${now.slice(0, 10)}`,
          });
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
      .select("id, failed_payment_count, status")
      .eq("host_id", hostId)
      .eq("product_id", productId)
      .maybeSingle();
    if (data) return data;
  }
  const { data: rows } = await supabase
    .from("subscriptions")
    .select("id, failed_payment_count, product_id, status")
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
async function processSubscriptionEvent(
  event: PaystackEvent,
  supabase: any,
  environment: "live" | "test",
) {
  const ref = event.data.reference;
  const meta = (event.data.metadata ?? {}) as Record<string, string>;
  const hostId = meta.host_id ?? null;
  const userId = meta.user_id ?? null;
  const plan = meta.plan ?? null;
  const cycle = meta.cycle === "annual" ? "annual" : "monthly";
  // `environment` is the VERIFIED webhook environment (R1) — resolved from the
  // Paystack key that matched the signature, NOT from event metadata (which a
  // native renewal may omit). Defaulting to "live" here would misbook test money.
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
      // Compare-and-set (R3): only the writer that flips pending→completed goes on
      // to extend the subscription. The hybrid renewal worker pre-creates + settles
      // this exact reference synchronously; this webhook is the backstop. Without
      // the guarded flip both could extend the period + double the history/credits.
      const { data: flipped } = await supabase
        .from("platform_ledger")
        .update({
          status: "completed",
          paid_at: now.toISOString(),
          period_start: now.toISOString(),
          period_end: addMonths(now, cycle === "annual" ? 12 : 1),
        })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id");
      if (!flipped || flipped.length === 0) return; // another path settled it
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
      // Capture the reusable card authorization so the renewal worker can
      // re-charge it each cycle (hybrid Paystack rail). Only when Paystack marks
      // it `reusable`; the code is encrypted, last4/brand/exp are display-only.
      // Refreshed on every charge.success so a card update stays current.
      const auth = event.data.authorization;
      const savedAuth: Record<string, unknown> = {};
      if (auth?.reusable && auth.authorization_code) {
        const cipher = await encryptSecret(auth.authorization_code);
        if (cipher) {
          savedAuth.paystack_authorization_code_cipher = cipher;
          savedAuth.paystack_card_last4 = auth.last4 ?? null;
          savedAuth.paystack_card_brand = auth.card_type ?? auth.brand ?? null;
          savedAuth.paystack_card_exp =
            auth.exp_month && auth.exp_year
              ? `${String(auth.exp_month).padStart(2, "0")}/${String(
                  auth.exp_year,
                ).slice(-2)}`
              : null;
        }
      }
      const custCode = event.data.customer?.customer_code;
      if (custCode) savedAuth.paystack_customer_code = custCode;

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
          ...savedAuth,
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
    // ── Ledger correctness ────────────────────────────────────────────────
    // A pre-created checkout row → mark it failed. An auto-renewal failure has
    // NO pre-created row, so record the failed attempt so the admin revenue view
    // reflects it. Idempotent on provider_reference (a retried webhook finds the
    // row already present and does nothing).
    if (row && row.status === "pending") {
      await supabase
        .from("platform_ledger")
        .update({ status: "failed" })
        .eq("id", row.id);
    } else if (!row) {
      await supabase.from("platform_ledger").insert({
        user_id: userId,
        host_id: hostId,
        subscription_id: sub?.id ?? null,
        plan,
        billing_cycle: cycle,
        type: "charge",
        status: "failed",
        amount,
        currency,
        provider: "paystack",
        provider_reference: ref,
        environment,
        reason: "Subscription renewal (failed)",
      });
    }

    if (sub) {
      const fails = Number(sub.failed_payment_count ?? 0) + 1;
      const cur = sub.status as string | null;

      // State-machine guard: only active/trialing enters grace (and starts the
      // 5-day clock). An already-past_due sub keeps its ORIGINAL deadline — a
      // repeatedly-failing card can't perpetually reset grace and dodge
      // restriction. A restricted sub stays restricted. We always bump the
      // failed-payment counter.
      const update: Record<string, unknown> = { failed_payment_count: fails };
      if (cur === "active" || cur === "trialing") {
        update.status = "past_due";
        update.grace_period_ends_at = new Date(
          now.getTime() + 5 * 86_400_000,
        ).toISOString();
      }
      await supabase.from("subscriptions").update(update).eq("id", sub.id);

      // Audit the transition (only when we actually moved into grace).
      if (cur === "active" || cur === "trialing") {
        await supabase.from("subscription_history").insert({
          subscription_id: sub.id,
          host_id: hostId,
          event: "subscription_payment_failed",
          to_status: "past_due",
          amount_charged: amount,
          currency,
          notes: `Charge failed (attempt ${fails}) — grace started`,
        });
      }

      // Notify the host + admin (deduped per distinct attempt so a retried
      // webhook doesn't double-send). Best-effort — never break the money path.
      if (hostId) {
        await supabase.rpc("notify_subscription_event", {
          p_host_id: hostId,
          p_subscription_id: sub.id,
          p_kind: "subscription_failed",
          p_extra: { amount },
          p_dedupe_key: `subscription_failed:${sub.id}:${fails}`,
        });
      }
    }
    return;
  }
}
