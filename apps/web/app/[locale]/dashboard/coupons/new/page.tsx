import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { Ticket } from "lucide-react";

import { loadFormDraft } from "@/lib/drafts/store";
import { createServerClient } from "@/lib/supabase/server";

import { CouponEditor, type CouponEditValues } from "../CouponEditor";
import { loadCouponFormData } from "../_data";

export const metadata: Metadata = { title: "New coupon" };

export const dynamic = "force-dynamic";

const BLANK: CouponEditValues = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "10",
  scope: "order",
  listingId: null,
  roomId: null,
  addonId: null,
  minNights: "",
  minSpend: "",
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  perGuestLimit: "",
  isActive: true,
};

export default async function NewCouponPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/coupons/new");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/dashboard/coupons");

  const { listings, addons } = await loadCouponFormData(supabase, host.id);

  if (listings.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          New coupon
        </h1>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Ticket className="h-6 w-6" />
          </div>
          <p className="mx-auto max-w-md text-sm text-brand-mute">
            Add a listing before you create coupons.
          </p>
          <Link
            href="/dashboard/properties/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-secondary"
          >
            New listing
          </Link>
        </div>
      </div>
    );
  }

  const serverDraft = await loadFormDraft(supabase, user.id, {
    entityType: "coupon",
    entityId: null,
    scopeId: null,
  });

  return (
    <CouponEditor
      mode="create"
      initial={BLANK}
      listings={listings}
      addons={addons}
      userId={user.id}
      serverDraft={serverDraft}
    />
  );
}
