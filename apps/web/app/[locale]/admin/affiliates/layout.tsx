import { ChevronRight } from "lucide-react";

import "@/components/affiliate/affiliate-manager.css";

import { AffiliateAdminNav } from "./_components/AffiliateAdminNav";

// Shared chrome for the admin affiliates area. Mirrors the partner-facing
// AffiliateShell (docs/design/affiliate-manager): the same header block + a
// .tabbtn sub-nav sit above every sub-route, and affiliate-manager.css is
// imported here so every admin sub-page can use the shared design classes
// (am-card / ttable / tag / smallcaps / btn-* / av-*).
export default function AffiliatesAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Header — matches the partner shell, only the crumb + copy differ. */}
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
      <div className="pt-6">{children}</div>
    </div>
  );
}
