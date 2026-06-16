import { notFound } from "next/navigation";

import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { confirmProductOrderByReference } from "@/lib/billing/product-checkout";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

import { PayButton } from "./PayButton";
import { Receipt } from "./Receipt";

export const dynamic = "force-dynamic";

export default async function ProductPayPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { reference?: string; trxref?: string };
}) {
  const service = createAdminClient();

  // Primary settle path: Paystack redirects back here with ?reference=…&trxref=…
  // Confirm server-side BEFORE reading the order so the page renders the paid
  // state immediately (the webhook is only an idempotent backstop).
  const reference = searchParams.reference ?? searchParams.trxref;
  if (reference) {
    await confirmProductOrderByReference(reference);
  }

  const { data: order } = await service
    .from("product_orders")
    .select(
      "id, product_id, product_name, amount, currency, status, payer_email, payer_user_id",
    )
    .eq("pay_token", params.token)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: product }, { data: settings }] = await Promise.all([
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
        "paystack_enabled, eft_enabled, eft_bank_name, eft_account_name, eft_account_number, eft_branch_code, eft_reference_hint",
      )
      .eq("id", true)
      .maybeSingle(),
  ]);

  const methods: string[] = Array.isArray(product?.payment_methods)
    ? (product!.payment_methods as string[])
    : ["paystack"];
  const showPaystack =
    methods.includes("paystack") && settings?.paystack_enabled;
  const showEft = methods.includes("eft") && settings?.eft_enabled;
  const paid = order.status === "paid";

  // Does this buyer already have a Vilo account? If not, after paying they go
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

  // Paid → the rich thank-you one-pager, driven by the issued Vilo invoice so the
  // figures match the invoice exactly (mirrors the signup last step).
  if (paid) {
    const { data: invoices } = await service
      .from("vilo_invoices")
      .select(
        "invoice_number, issued_at, subtotal, vat_amount, total_amount, currency, hosted_token",
      )
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const invoice = invoices?.[0] ?? null;
    const brandName = await getBrandName();
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
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Pay Vilo
        </div>
        <h1 className="mt-1 font-display text-xl font-bold text-brand-ink">
          {order.product_name}
        </h1>
        <div className="mt-2 font-display text-2xl font-bold text-brand-ink">
          {formatZar(Number(order.amount))}
        </div>

        <div className="mt-6 space-y-5">
          {showPaystack ? <PayButton token={params.token} /> : null}

          {showEft ? (
            <div className="rounded-md border border-brand-line bg-brand-light/40 p-4 text-sm">
              <div className="mb-2 font-semibold text-brand-ink">
                Or pay by EFT
              </div>
              <dl className="space-y-1 text-[13px] text-brand-mute">
                <Row k="Bank" v={settings?.eft_bank_name} />
                <Row k="Account name" v={settings?.eft_account_name} />
                <Row k="Account number" v={settings?.eft_account_number} />
                <Row k="Branch code" v={settings?.eft_branch_code} />
                <Row
                  k="Reference"
                  v={settings?.eft_reference_hint || order.id.slice(0, 8)}
                />
              </dl>
              <p className="mt-2 text-[11px] text-brand-mute">
                Once paid, email proof to Vilo and we&apos;ll confirm your
                order.
              </p>
            </div>
          ) : null}

          {!showPaystack && !showEft ? (
            <p className="text-sm text-brand-mute">
              No payment method is available for this product yet. Please
              contact Vilo.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{k}</dt>
      <dd className="font-mono font-medium text-brand-ink">{v ?? "—"}</dd>
    </div>
  );
}
