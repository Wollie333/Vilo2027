import { NextResponse } from "next/server";

import {
  activatePayPalSubscription,
  markPayPalPaymentFailed,
  markPayPalSubscriptionEnded,
  recordPayPalSaleCompleted,
} from "@/lib/billing/paypal-subscription";
import { getPlatformPayPal } from "@/lib/payments/platform-paypal";
import { verifyPayPalWebhookSignature } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PayPal webhook — native subscription lifecycle (Wielo platform rail).
 *
 * PayPal has no merchant-initiated recurring charge, so renewals arrive only as
 * server-to-server webhooks: this route is the sole settle path for PayPal
 * subscription money. Every event is verified via PayPal's own
 * verify-webhook-signature API (headers alone are forgeable) using
 * PAYPAL_WEBHOOK_ID; an unverifiable event is rejected (fail closed).
 *
 * Processing is synchronous + idempotent (money keyed by the PayPal sale id,
 * lifecycle ops naturally idempotent), and a 500 asks PayPal to redeliver — so a
 * transient DB blip never loses an event. Register this URL as the webhook in the
 * PayPal app; set PAYPAL_WEBHOOK_ID to its id.
 *
 * (Chosen as a Next route, not a Deno edge fn, so it reuses getPlatformPayPal +
 * lib/fx + the shared settle helpers instead of re-implementing crypto/fx.)
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  const creds = await getPlatformPayPal();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!creds || !webhookId) {
    // Not configured → can't verify → refuse (fail closed).
    return NextResponse.json(
      { success: false, error: { code: "PAYPAL_NOT_CONFIGURED", message: "" } },
      { status: 401 },
    );
  }

  const verified = await verifyPayPalWebhookSignature({
    headers: {
      transmissionId: req.headers.get("paypal-transmission-id"),
      transmissionTime: req.headers.get("paypal-transmission-time"),
      certUrl: req.headers.get("paypal-cert-url"),
      authAlgo: req.headers.get("paypal-auth-algo"),
      transmissionSig: req.headers.get("paypal-transmission-sig"),
    },
    rawBody,
    webhookId,
    creds,
  });
  if (!verified) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_SIGNATURE", message: "" } },
      { status: 401 },
    );
  }

  let event: {
    event_type?: string;
    resource?: {
      id?: string;
      billing_agreement_id?: string;
      amount?: { total?: string; currency?: string };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_PAYLOAD", message: "" } },
      { status: 400 },
    );
  }

  const environment = creds.env; // "test" | "live" — from the verifying app
  const admin = createAdminClient();

  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const id = event.resource?.id;
        if (id) await activatePayPalSubscription(admin, id);
        break;
      }
      case "PAYMENT.SALE.COMPLETED": {
        // For subscription payments the sale carries billing_agreement_id (the
        // subscription id) + the USD amount. Idempotent on the sale id.
        const saleId = event.resource?.id;
        const subId = event.resource?.billing_agreement_id;
        const usd = Number(event.resource?.amount?.total ?? 0);
        if (saleId && subId && usd > 0) {
          await recordPayPalSaleCompleted(admin, {
            saleId,
            subscriptionId: subId,
            amountUsd: usd,
            environment,
          });
        }
        break;
      }
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const id = event.resource?.id;
        if (id)
          await markPayPalSubscriptionEnded(admin, {
            subscriptionId: id,
            status: "cancelled",
          });
        break;
      }
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        const id = event.resource?.id;
        if (id)
          await markPayPalSubscriptionEnded(admin, {
            subscriptionId: id,
            status: "paused",
          });
        break;
      }
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        const id = event.resource?.id;
        if (id) await markPayPalPaymentFailed(admin, id);
        break;
      }
      default:
        // Unhandled event types are acknowledged (200) so PayPal stops retrying.
        break;
    }
  } catch (err) {
    // Ask PayPal to redeliver on a transient failure.
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { code: "PAYPAL_WEBHOOK_FAILED", message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
