import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getPlatformPaystackSecret } from "@/lib/billing/platform-billing";
import { verifyTransaction } from "@/lib/paystack";

export const dynamic = "force-dynamic";

// Paystack redirects here after the host pays for a plan. We verify the
// transaction (platform key) as defence-in-depth and show the outcome — the
// webhook is the source of truth that activates the subscription + completes the
// ledger row.
export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams?: { reference?: string; trxref?: string };
}) {
  const reference = searchParams?.reference ?? searchParams?.trxref ?? null;

  let state: "success" | "pending" | "failed" = "pending";
  const secret = await getPlatformPaystackSecret();
  if (reference && secret) {
    try {
      const tx = await verifyTransaction(reference, secret);
      if (tx?.status === "success") state = "success";
      else if (tx && tx.status !== "success") state = "failed";
    } catch {
      state = "pending";
    }
  }

  const view = {
    success: {
      Icon: CheckCircle2,
      tone: "text-status-confirmed",
      title: "Payment received",
      body: "Your subscription is being activated. It usually takes a few seconds — refresh your subscription page if it hasn't updated yet.",
    },
    pending: {
      Icon: Clock,
      tone: "text-status-pending",
      title: "Payment processing",
      body: "We're confirming your payment with Paystack. Your plan will update automatically once it clears.",
    },
    failed: {
      Icon: XCircle,
      tone: "text-status-cancelled",
      title: "Payment not completed",
      body: "The payment didn't go through. You can try again from your subscription page — you won't be charged twice.",
    },
  }[state];

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-card border border-brand-line bg-white p-8 text-center shadow-card">
        <view.Icon className={`mx-auto h-12 w-12 ${view.tone}`} />
        <h1 className="mt-4 font-display text-xl font-bold text-brand-ink">
          {view.title}
        </h1>
        <p className="mt-2 text-sm text-brand-mute">{view.body}</p>
        {reference ? (
          <p className="mt-3 font-mono text-[11px] text-brand-mute">
            Ref: {reference}
          </p>
        ) : null}
        <Link
          href="/dashboard/settings/subscription"
          className="mt-6 inline-flex items-center justify-center rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Back to subscription
        </Link>
      </div>
    </div>
  );
}
