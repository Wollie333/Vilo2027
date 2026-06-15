import { ArrowRight, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";

import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

import { PayButton } from "./PayButton";

export const dynamic = "force-dynamic";

export default async function ProductPayPage({
  params,
}: {
  params: { token: string };
}) {
  const service = createAdminClient();

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

        {paid ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-status-confirmed/30 bg-status-confirmed/10 px-4 py-3 text-sm font-semibold text-status-confirmed">
              <CheckCircle2 className="h-5 w-5" /> Paid — thank you!
            </div>
            {hasAccount ? (
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
              >
                Log in to your account <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href={`/signup/host?order=${params.token}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
                >
                  Create your account <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-center text-[12px] text-brand-mute">
                  Finish setting up your account — your subscription is already
                  active.
                </p>
              </>
            )}
          </div>
        ) : (
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
        )}
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
