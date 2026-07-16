"use client";

import { ArrowRight, Download, Loader2, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { firePurchase } from "@/lib/analytics/purchase";
import { passwordSchema } from "@/lib/auth/password";

import { claimProductAccountAction } from "./actions";

// Post-payment thank-you one-pager for a Wielo product/subscription purchase —
// mirrors the signup last step (StepWelcome) receipt. Dynamic values come from
// the issued Wielo invoice so what the buyer sees matches their invoice exactly.

export type ReceiptPurchase = {
  brandName: string;
  productName: string;
  reference: string; // invoice number
  dateIso: string;
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  invoiceToken: string | null;
  buyerEmail: string | null;
  hasAccount: boolean;
  /** Pay-token — lets a new buyer claim their account inline (set password). */
  payToken: string;
  signupHref: string;
  /** Stable id for the Meta Pixel / CAPI dedupe (invoice number or order id). */
  eventId: string;
  productId: string | null;
};

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  })
    .format(n)
    .replace(/ /g, " ");
}

export function Receipt({ purchase: p }: { purchase: ReceiptPurchase }) {
  const date = new Date(p.dateIso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const hasVat = p.vat > 0.005;

  // Fire the GA4/GTM purchase + Meta Pixel Purchase once, with the real amount.
  useEffect(() => {
    firePurchase({
      transactionId: p.eventId,
      value: p.total,
      currency: p.currency,
      contentName: p.productName,
      contentIds: [p.productId ?? p.eventId],
      numItems: 1,
      items: [
        {
          item_id: p.productId ?? p.eventId,
          item_name: p.productName,
          price: p.total,
          quantity: 1,
        },
      ],
    });
  }, [p.eventId, p.total, p.currency, p.productName, p.productId]);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-[11px] font-semibold text-brand-secondary">
        <PartyPopper className="h-3.5 w-3.5" /> Payment received
      </div>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
        Thank you — you&rsquo;re all set.
      </h1>
      <p className="mt-2 text-sm text-brand-mute md:text-base">
        Here&rsquo;s a summary of your purchase
        {p.buyerEmail ? (
          <>
            {" "}
            A copy has been sent to{" "}
            <span className="font-medium text-brand-ink">{p.buyerEmail}</span>.
          </>
        ) : (
          "."
        )}
      </p>

      {/* Receipt */}
      <div className="mt-6 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-line bg-brand-light/50 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Purchase
            </div>
            <div className="mt-1 font-display text-xl font-bold text-brand-ink">
              {p.productName}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Invoice
            </div>
            <div className="num mt-1 font-mono text-sm font-semibold text-brand-ink">
              {p.reference}
            </div>
            <div className="mt-1 text-xs text-brand-mute">{date}</div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-brand-ink">
              {p.productName}
            </div>
            <div className="num font-display text-base font-bold text-brand-ink">
              {money(p.total, p.currency)}
            </div>
          </div>
        </div>

        <div className="border-t border-brand-line bg-brand-light/40 px-5 py-4">
          {hasVat ? (
            <>
              <div className="flex items-center justify-between text-xs text-brand-mute">
                <span>Subtotal</span>
                <span className="num font-mono text-brand-ink">
                  {money(p.subtotal, p.currency)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-brand-mute">
                <span>VAT · 15%</span>
                <span className="num font-mono text-brand-ink">
                  {money(p.vat, p.currency)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-brand-line pt-3">
                <div className="text-sm font-semibold text-brand-ink">
                  Total
                </div>
                <div className="num font-display text-lg font-bold text-brand-ink">
                  {money(p.total, p.currency)}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-brand-ink">
                Total paid
              </div>
              <div className="num font-display text-lg font-bold text-brand-ink">
                {money(p.total, p.currency)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice download */}
      {p.invoiceToken ? (
        <div className="mt-6">
          <a
            href={`/wielo-invoice/${p.invoiceToken}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light/60"
          >
            <Download className="h-4 w-4" /> Download invoice
          </a>
        </div>
      ) : null}

      {/* Next step — an existing account just logs in; a new buyer sets a
          password inline and drops straight into their dashboard. */}
      {p.hasAccount ? (
        <div className="mt-6 flex justify-end">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
          >
            Log in to your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <SetPasswordCard payToken={p.payToken} email={p.buyerEmail} />
      )}
    </div>
  );
}

// New buyer → claim the account: set a password and go straight to the dashboard.
// Your purchase is already active; this just secures the account behind a
// password (the buyer was created as a passwordless lead at checkout).
function SetPasswordCard({
  payToken,
  email,
}: {
  payToken: string;
  email: string | null;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function submit() {
    const check = passwordSchema.safeParse(password);
    if (!check.success) {
      toast.error(
        check.error.issues[0]?.message ?? "Choose a stronger password.",
      );
      return;
    }
    setBusy(true);
    (async () => {
      try {
        const r = await claimProductAccountAction(payToken, password);
        if (r.ok) {
          // Magic link → signs in → lands on the dashboard.
          window.location.href = r.url;
        } else {
          setBusy(false);
          toast.error(r.error);
        }
      } catch {
        setBusy(false);
        toast.error("Something went wrong. Please try again.");
      }
    })();
  }

  return (
    <div className="mt-6 rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="font-display text-lg font-bold text-brand-ink">
        Set a password to access your dashboard
      </h2>
      <p className="mt-1 text-[13px] text-brand-mute">
        Your purchase is already active. Set a password
        {email ? (
          <>
            {" "}
            for <span className="font-medium text-brand-ink">{email}</span>
          </>
        ) : null}{" "}
        to finish setting up your account.
      </p>
      <div className="mt-4 space-y-3">
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) submit();
          }}
        />
        <button
          type="button"
          disabled={busy || !password}
          onClick={submit}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Setting up…
            </>
          ) : (
            <>
              Go to your dashboard <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
