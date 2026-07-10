import { ShieldCheck } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import {
  CANONICAL_GUEST_PERMISSIONS,
  getGuestPermissions,
} from "@/lib/guests/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { AudienceTabs } from "./AudienceTabs";
import { GuestPermissionsForm } from "./GuestPermissionsForm";
import { HostOverrideForm } from "./HostOverrideForm";

export const dynamic = "force-dynamic";

// What a host can do is decided by their PRODUCT (subscription tier / service) —
// each product's features are configured per-product under Products. This page
// is NOT where tier features are set; it exists for the two things products
// don't cover: a one-off per-host exception, and the global guest permission set.
export default async function FeatureFlagsPage() {
  await requirePermission("platform.features");
  const service = createAdminClient();

  const [{ data: planFeatureRows }, { data: productFeatureRows }, guestPerms] =
    await Promise.all([
      service.from("plan_features").select("feature_key"),
      service.from("product_features").select("feature_key"),
      getGuestPermissions(),
    ]);

  // Full feature catalog for the override dropdown = every feature key known to
  // either products (the real source of truth) or the legacy plan table.
  const featureKeys = [
    ...new Set([
      ...(planFeatureRows ?? []).map((r) => r.feature_key),
      ...(productFeatureRows ?? []).map((r) => r.feature_key),
    ]),
  ].sort();

  const hostView = (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-card border border-brand-line bg-[#F6FAF7] px-4 py-3 text-[13px] text-brand-dark">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        <div>
          <span className="font-semibold">
            Tier features are set per product.
          </span>{" "}
          What each subscription includes is configured on the product itself —
          edit its features under{" "}
          <Link
            href="/admin/products"
            className="font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Products
          </Link>
          . Access resolves live: a per-host override → the host&apos;s product
          features → deny. Use the form below only to grant or revoke a single
          feature for one host as an exception.
        </div>
      </div>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Per-host override
        </h2>
        <p className="mb-4 mt-1 text-[13px] text-brand-mute">
          Grant or revoke a single feature for one host outside their plan (e.g.
          a courtesy upgrade or a trial). Checked before the product features. A
          reason is recorded in the audit log.
        </p>
        <HostOverrideForm featureKeys={featureKeys} />
      </section>
    </div>
  );

  const guestView = (
    <GuestPermissionsForm
      catalog={CANONICAL_GUEST_PERMISSIONS}
      initial={guestPerms}
    />
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Feature permissions
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          <strong>Hosts</strong> unlock features through their
          product/subscription (configured under Products); this page handles
          per-host exceptions. <strong>Guests</strong> share one global
          permission set. Changes save instantly and gates read this live.
        </p>
      </header>

      <AudienceTabs host={hostView} guest={guestView} />
    </div>
  );
}
