import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/safeNext";
import { confirmProductOrderByReference } from "@/lib/billing/product-checkout";
import { getBrandName } from "@/lib/brand";
import { getSubscriptionProducts } from "@/lib/products/getProducts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/taxonomy/getCategories";

import { Wizard } from "./Wizard";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: "Become a host",
    description: `Set up your ${brandName} host profile and your first listing — five quick steps.`,
  };
}

export const dynamic = "force-dynamic";

export type PaidReceipt = {
  hostId: string;
  handle: string;
  fullName: string;
  email: string;
  plan: "free" | "basic" | "pro" | "business";
  billingCycle: "monthly" | "annual";
  // Purchase-pixel payload (fired on the wizard Welcome step). transactionId is
  // stable (invoice number, else order id) so a refresh / future CAPI dedupes.
  transactionId: string;
  amount: number;
  currency: string;
  productId: string | null;
  productName: string;
};

export default async function HostSignupPage({
  searchParams,
}: {
  searchParams?: {
    order?: string;
    next?: string;
    paid_token?: string;
    reference?: string;
    trxref?: string;
  };
}) {
  // A quote (or other) intent to return to after onboarding. Same-origin guard.
  const nextPath = safeNextPath(searchParams?.next);

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Paystack return from a pay-during-signup checkout ────────────
  // Paystack sends the host back here (?paid_token=…&reference=…) instead of the
  // standalone /pay/product page, so the wizard can render its OWN Welcome step.
  // Settle the payment server-side (primary path; webhook is the backstop), then
  // build the receipt data so the wizard opens on its final step.
  let paidReceipt: PaidReceipt | null = null;
  const paidToken = (searchParams?.paid_token ?? "").trim();
  const reference = searchParams?.reference ?? searchParams?.trxref;
  if (paidToken && user) {
    if (reference) await confirmProductOrderByReference(reference);
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("product_orders")
      .select(
        "id, status, payer_email, payer_user_id, product_id, product_name, amount, currency",
      )
      .eq("pay_token", paidToken)
      .maybeSingle();
    const belongs =
      order?.payer_user_id === user.id ||
      (order?.payer_email ?? "").toLowerCase() ===
        (user.email ?? "").toLowerCase();
    if (order && order.status === "paid" && belongs) {
      const { data: host } = await admin
        .from("hosts")
        .select("id, handle")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (host) {
        const [{ data: sub }, { data: profile }, { data: invoices }] =
          await Promise.all([
            admin
              .from("subscriptions")
              .select("plan, billing_cycle")
              .eq("host_id", host.id)
              .maybeSingle(),
            admin
              .from("user_profiles")
              .select("full_name")
              .eq("id", user.id)
              .maybeSingle(),
            admin
              .from("wielo_invoices")
              .select("invoice_number")
              .eq("order_id", order.id)
              .order("created_at", { ascending: false })
              .limit(1),
          ]);
        const plan = (sub?.plan ?? "free") as PaidReceipt["plan"];
        const billingCycle = (
          sub?.billing_cycle === "annual" ? "annual" : "monthly"
        ) as PaidReceipt["billingCycle"];
        paidReceipt = {
          hostId: host.id,
          handle: host.handle,
          fullName: profile?.full_name ?? user.email ?? "",
          email: user.email ?? "",
          plan,
          billingCycle,
          transactionId: invoices?.[0]?.invoice_number ?? order.id,
          amount: Number(order.amount),
          currency: order.currency,
          productId: order.product_id,
          productName: order.product_name,
        };
      }
    }
  }

  // If they arrived from a paid product link (/p/[slug] → pay → here), load the
  // paid order so the wizard can lock the toolkit step to that purchase and the
  // account step can prefill the email they paid with.
  let purchasedProductName: string | null = null;
  let purchasedOrderToken: string | null = null;
  let purchasedEmail: string | null = null;
  const orderToken = (searchParams?.order ?? "").trim();
  if (orderToken) {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("product_orders")
      .select("pay_token, product_name, payer_email, status")
      .eq("pay_token", orderToken)
      .maybeSingle();
    if (order && order.status === "paid") {
      purchasedProductName = order.product_name ?? null;
      purchasedOrderToken = order.pay_token ?? null;
      purchasedEmail = order.payer_email ?? null;
    }
  }

  let prefilledFullName: string | null = null;
  let prefilledPhone: string | null = null;
  let prefilledBio: string | null = null;
  let prefilledAvatar: string | null = null;
  let prefilledLanguages: string[] | null = null;
  let prefilledCountry: string | null = null;

  // If they're already a host, send them home — no point re-onboarding.
  if (user) {
    const { data: existingHost } = await supabase
      .from("hosts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingHost && !paidReceipt) {
      // Already a host — honour the pending intent (e.g. a quote) if present.
      // Exception: a paid-signup return renders the wizard's Welcome step below.
      redirect(nextPath ?? "/dashboard");
    }

    // Pre-seed any About-step fields they've already entered (full_name
    // gets set on signup or via prior wizard runs). Without this, a user
    // resuming the wizard would land on step 2 with empty fields and
    // finalize would fail Zod validation on full_name (min 2).
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, phone, bio, avatar_url, languages, country")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      prefilledFullName = (profile.full_name as string | null) ?? null;
      prefilledPhone = (profile.phone as string | null) ?? null;
      prefilledBio = (profile.bio as string | null) ?? null;
      prefilledAvatar = (profile.avatar_url as string | null) ?? null;
      prefilledLanguages = (profile.languages as string[] | null) ?? null;
      prefilledCountry = (profile.country as string | null) ?? null;
    }
  }

  // Real subscription products to pick from in the toolkit step.
  const products = await getSubscriptionProducts();

  // Flatten the category tree to accommodation leaves only (skip the
  // Accommodation root). MVP lists accommodation only.
  const tree = await getCategoryTree();
  const categoryLeaves = tree.accommodation.flatMap((root) =>
    root.children.map((c) => ({
      id: c.id,
      label: c.label,
      slug: c.slug,
      kind: c.kind,
      description: c.description,
    })),
  );

  // Unsigned users can land here directly — Step 1 (Account) creates the
  // auth user. If a signed-in user (no host row yet) comes back to finish,
  // we skip Step 1 and seed every About-step field we already have.
  return (
    <Wizard
      prefilledEmail={user?.email ?? null}
      prefilledFullName={prefilledFullName}
      prefilledPhone={prefilledPhone}
      prefilledBio={prefilledBio}
      prefilledAvatar={prefilledAvatar}
      prefilledLanguages={prefilledLanguages}
      prefilledCountry={prefilledCountry}
      categoryLeaves={categoryLeaves}
      products={products}
      purchasedProductName={purchasedProductName}
      purchasedOrderToken={purchasedOrderToken}
      purchasedEmail={purchasedEmail}
      paidReceipt={paidReceipt}
      next={nextPath}
    />
  );
}
