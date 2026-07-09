import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Hash, Mail, Package } from "lucide-react";

import {
  capturePayPalProductOrder,
  confirmProductOrderByReference,
} from "@/lib/billing/product-checkout";
import { getWieloBusinessProfile } from "@/lib/billing/wielo-invoice";
import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

import { EftPayPanel } from "./EftPayPanel";

import { PayButton, PayPalButton, ProductPayPalButtons } from "./PayButton";
import { Receipt } from "./Receipt";

export const metadata: Metadata = {
  title: "Wielo · Secure payment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProductPayPage({
  params,
  searchParams,
}: {
  params: { token: string };
  // reference/trxref = Paystack return; token = PayPal return (?token=<orderId>).
  searchParams: { reference?: string; trxref?: string; token?: string };
}) {
  const service = createAdminClient();

  // Primary settle path: Paystack redirects back with ?reference=…&trxref=…;
  // PayPal returns with ?token=<orderId>. Settle server-side BEFORE reading the
  // order so the page renders the paid state immediately (the webhook is only an
  // idempotent backstop for Paystack).
  const reference = searchParams.reference ?? searchParams.trxref;
  if (reference) {
    await confirmProductOrderByReference(reference);
  } else if (searchParams.token) {
    await capturePayPalProductOrder(searchParams.token);
  }

  const { data: order } = await service
    .from("product_orders")
    .select(
      "id, product_id, product_name, amount, currency, status, payer_email, payer_user_id",
    )
    .eq("pay_token", params.token)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: product }, { data: settings }, brandName, issuer] =
    await Promise.all([
      order.product_id
        ? service
            .from("products")
            .select("payment_methods")
            .eq("id", order.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      service
        .from("platform_payment_settings")
        .select(
          "paystack_enabled, paypal_enabled, paypal_client_id, eft_enabled, eft_bank_name, eft_account_name, eft_account_number, eft_branch_code, eft_reference_hint",
        )
        .eq("id", true)
        .maybeSingle(),
      getBrandName(),
      getWieloBusinessProfile(),
    ]);

  // Strictly the product's accepted methods. If a product has none configured,
  // fall back to EFT (the universal rail), NEVER paystack — so a card option
  // never appears on a product the admin didn't enable it for.
  const methods: string[] =
    Array.isArray(product?.payment_methods) &&
    (product!.payment_methods as string[]).length > 0
      ? (product!.payment_methods as string[])
      : ["eft"];
  const showPaystack =
    methods.includes("paystack") && settings?.paystack_enabled;
  const showPaypal = methods.includes("paypal") && settings?.paypal_enabled;
  const showEft = methods.includes("eft") && settings?.eft_enabled;
  const paid = order.status === "paid";

  // Does this buyer already have a Wielo account? If not, after paying they go
  // straight into the signup flow to complete their account (the toolkit step is
  // locked to this purchase).
  let hasAccount = !!order.payer_user_id;
  if (!hasAccount && order.payer_email) {
    const { data: existing } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", order.payer_email)
      .maybeSingle();
    hasAccount = !!existing;
  }

  // Paid → the rich thank-you one-pager, driven by the issued Wielo invoice so the
  // figures match the invoice exactly (mirrors the signup last step).
  if (paid) {
    const { data: invoices } = await service
      .from("wielo_invoices")
      .select(
        "invoice_number, issued_at, subtotal, vat_amount, total_amount, currency, hosted_token",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const invoice = invoices?.[0] ?? null;
    return (
      <Receipt
        purchase={{
          brandName,
          productName: order.product_name,
          reference: invoice?.invoice_number ?? "—",
          dateIso: invoice?.issued_at ?? new Date().toISOString(),
          subtotal: Number(invoice?.subtotal ?? order.amount),
          vat: Number(invoice?.vat_amount ?? 0),
          total: Number(invoice?.total_amount ?? order.amount),
          currency: invoice?.currency ?? order.currency,
          invoiceToken: invoice?.hosted_token ?? null,
          buyerEmail: order.payer_email,
          hasAccount,
          signupHref: `/signup/host?order=${params.token}`,
          eventId: invoice?.invoice_number ?? order.id,
          productId: order.product_id,
        }}
      />
    );
  }

  const currency = order.currency ?? "ZAR";
  const amount = Number(order.amount);
  const issuerName = issuer.legal_name?.trim() || brandName;
  const noMethod = !showPaystack && !showPaypal && !showEft;

  return (
    // Standalone payment page — mirrors the guest booking pay page, but for a
    // Wielo product order. No directory chrome, just product + payment details.
    <div className="min-h-screen bg-white text-brand-ink">
      <main className="mx-auto max-w-xl px-5 py-10 lg:py-14">
        <header className="text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
            {brandName} · Secure payment
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-brand-ink">
            Pay for {order.product_name}
          </h1>
        </header>

        {/* Order summary */}
        <section className="mt-7 overflow-hidden rounded-card border border-brand-line bg-white">
          <div className="border-b border-brand-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-brand-light text-brand-secondary">
                <Package className="h-5 w-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="font-display font-semibold text-brand-ink">
                  {order.product_name}
                </div>
                <div className="mt-0.5 text-[11px] text-brand-mute">
                  Billed by {issuerName}
                </div>
              </div>
            </div>
          </div>
          <dl className="divide-y divide-brand-line text-sm">
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="inline-flex items-center gap-2 text-brand-mute">
                <Mail className="h-4 w-4" /> Billed to
              </dt>
              <dd className="text-right font-medium text-brand-ink">
                {order.payer_email}
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="inline-flex items-center gap-2 text-brand-mute">
                <Hash className="h-4 w-4" /> Reference
              </dt>
              <dd className="font-mono text-xs font-medium text-brand-ink">
                {order.id.slice(0, 8).toUpperCase()}
              </dd>
            </div>
          </dl>
        </section>

        {/* Amount + action */}
        <section className="mt-6 space-y-5">
          <div className="rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
            <div className="flex items-end justify-between">
              <div className="text-sm text-brand-mute">Amount due</div>
              <div className="font-display text-2xl font-semibold text-brand-ink">
                {formatMoney(amount, currency)}
              </div>
            </div>
          </div>

          {showPaystack ? <PayButton token={params.token} /> : null}

          {showPaypal ? (
            settings?.paypal_client_id ? (
              <ProductPayPalButtons
                token={params.token}
                clientId={settings.paypal_client_id}
                secondary={showPaystack}
              />
            ) : (
              <PayPalButton token={params.token} secondary={showPaystack} />
            )
          ) : null}

          {showEft ? (
            <EftPayPanel
              token={params.token}
              issuerName={issuerName}
              secondary={showPaystack || showPaypal}
              banking={{
                bankName: settings?.eft_bank_name ?? null,
                accountName: settings?.eft_account_name ?? null,
                accountNumber: settings?.eft_account_number ?? null,
                branchCode: settings?.eft_branch_code ?? null,
                reference: settings?.eft_reference_hint || order.id.slice(0, 8),
              }}
            />
          ) : null}

          {noMethod ? (
            <div className="rounded-card border border-brand-line bg-brand-light/40 px-5 py-6 text-center text-sm text-brand-mute">
              No payment method is available for this product yet. Please
              contact {issuerName}.
            </div>
          ) : null}
        </section>

        <p className="mt-8 text-center text-xs text-brand-mute">
          Secure payment to {issuerName} via {brandName}.
        </p>
      </main>
    </div>
  );
}
