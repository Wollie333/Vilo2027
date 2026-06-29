"use client";

import { ArrowRight, Download, PartyPopper } from "lucide-react";
import { useEffect } from "react";

import { Link } from "@/i18n/navigation";
import { firePurchase } from "@/lib/analytics/purchase";

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

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {p.invoiceToken ? (
          <a
            href={`/wielo-invoice/${p.invoiceToken}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light/60"
          >
            <Download className="h-4 w-4" /> Download invoice
          </a>
        ) : (
          <span />
        )}

        {p.hasAccount ? (
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
          >
            Log in to your account <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href={p.signupHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
          >
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {!p.hasAccount ? (
        <p className="mt-3 text-center text-[12px] text-brand-mute sm:text-right">
          Finish setting up your account — your purchase is already active.
        </p>
      ) : null}
    </div>
  );
}
