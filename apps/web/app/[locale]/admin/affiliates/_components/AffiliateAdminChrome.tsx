"use client";

import { ChevronRight } from "lucide-react";

import { usePathname } from "@/i18n/navigation";

import { AffiliateAdminNav } from "./AffiliateAdminNav";

// The affiliate admin header + sub-nav. Hidden on a single campaign's detail
// page: that screen is a focused workspace with its own header, back button and
// breadcrumbs, so the program-level chrome would just be noise (founder ask).
const CAMPAIGN_DETAIL = /\/admin\/affiliates\/campaigns\/[^/]+$/;

export function AffiliateAdminChrome() {
  const pathname = usePathname();
  if (CAMPAIGN_DETAIL.test(pathname)) return null;

  return (
    <>
      <div className="pb-1">
        <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
          <span>Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-brand-ink">Affiliates</span>
        </nav>
        <h1 className="mt-1 font-display text-[24px] font-extrabold leading-none text-brand-ink">
          Affiliate program
        </h1>
        <div className="mt-1.5 text-[12.5px] text-brand-mute">
          Partners, payouts, campaigns and programme settings · commission rates
          are set per product in the Product manager
        </div>
      </div>

      <AffiliateAdminNav />
      <div className="pt-6" />
    </>
  );
}
