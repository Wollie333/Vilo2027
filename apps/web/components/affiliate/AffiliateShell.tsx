import { ChevronRight, Wallet } from "lucide-react";

import "./affiliate-manager.css";

import { Link } from "@/i18n/navigation";
import { AffiliateNav } from "@/app/[locale]/portal/affiliates/_components/AffiliateNav";
import { AffiliateTermsGate } from "@/app/[locale]/portal/affiliates/_components/AffiliateTermsGate";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import {
  activateAffiliateIfReady,
  evaluateAffiliateActivation,
} from "@/lib/affiliate/activation";
import { hasSignedVersion } from "@/lib/affiliate/agreement";
import { AffiliateActivationChecklist } from "@/components/affiliate/AffiliateActivationChecklist";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

// The affiliate area is ONE program per user (keyed by user_id), mounted under
// BOTH shells: the guest portal (/portal/affiliates) for guests and the host
// dashboard (/dashboard/affiliates) for hosts — so each entity reaches it inside
// its own chrome instead of being thrown into the other's. This shared shell
// renders the identical gate + header + nav for both; only the base path (nav
// hrefs) and the breadcrumb label differ.
export async function AffiliateShell({
  basePath,
  crumbLabel,
  children,
}: {
  basePath: string;
  crumbLabel: string;
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);

  // WS-6b — the gate is keyed off a SIGNED agreement for the version currently
  // on file, not off the existence of an account. So a partner who joined before
  // signatures were recorded, or one whose terms have since been re-versioned,
  // signs again before reaching the portal.
  const { data: settings } = await admin
    .from("affiliate_settings")
    .select("terms_version, terms_content")
    .eq("id", true)
    .maybeSingle();
  const termsVersion = settings?.terms_version ?? "v1";
  const signed = account
    ? await hasSignedVersion(admin, account.id, termsVersion)
    : false;

  if (!account || !signed) {
    return (
      <AffiliateTermsGate
        brand={await getBrandName()}
        termsVersion={termsVersion}
        termsContent={settings?.terms_content ?? ""}
        mode={account ? "resign" : "join"}
      />
    );
  }

  // A partner who signed up through the public form is PENDING until every gate
  // closes. Re-check on every portal open: the last gate is usually the email
  // confirmation, which may have been clicked in another tab or on their phone.
  let status = account.status;
  if (status === "pending") {
    const { activated } = await activateAffiliateIfReady(admin, account.id);
    if (activated) status = "active";
  }

  // Tab badge = active campaigns the partner could join / is in.
  const { count: campaignCount } = await admin
    .from("affiliate_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const memberSince = account.accepted_at
    ? new Date(account.accepted_at).toLocaleDateString("en-ZA", {
        month: "long",
        year: "numeric",
      })
    : null;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://wielo.co.za";
  const refUrlShort = `${baseUrl}/r/${account.slug}`.replace(
    /^https?:\/\//,
    "",
  );
  const isActive = status === "active";
  const isPending = status === "pending";
  const statusLabel = isActive
    ? "Active partner"
    : isPending
      ? "Finishing setup"
      : "Suspended";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-1">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <span>{crumbLabel}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">Affiliates</span>
          </nav>
          <h1 className="mt-1 font-display text-[24px] font-extrabold leading-none text-brand-ink">
            Affiliate program
          </h1>
          <div className="mt-1.5 text-[12.5px] text-brand-mute">
            {memberSince ? `Partner since ${memberSince} · ` : null}
            <span className="font-medium text-brand-primary">
              {refUrlShort}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 pb-0.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold ${
              isActive
                ? "border-[#C7F0DC] bg-[#ECFDF5] text-[#047857]"
                : "border-[#FDE9C8] bg-[#FFFBEB] text-[#B45309]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-brand-primary" : "bg-status-pending"
              }`}
            />
            {statusLabel}
          </span>
          {isActive ? (
            <Link href={`${basePath}/payouts`} className="btn-pri h-9">
              <Wallet className="h-4 w-4" /> Request payout
            </Link>
          ) : null}
        </div>
      </div>

      {/* A pending partner sees the remaining steps rather than the portal — the
          tabs would offer referral links and payouts that cannot work yet. */}
      {isPending ? (
        <div className="pt-6">
          <AffiliateActivationChecklist
            checklist={await evaluateAffiliateActivation(admin, account.id)}
          />
        </div>
      ) : (
        <>
          <AffiliateNav
            campaignCount={campaignCount ?? 0}
            basePath={basePath}
          />
          <div className="pt-6">{children}</div>
        </>
      )}
    </div>
  );
}
