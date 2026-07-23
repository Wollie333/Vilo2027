import "@/components/affiliate/affiliate-manager.css";

import { AffiliateAdminChrome } from "./_components/AffiliateAdminChrome";

// Shared chrome for the admin affiliates area. affiliate-manager.css is imported
// here so every admin sub-page can use the shared design classes (am-card /
// ttable / tag / smallcaps / btn-* / av-*). The header + sub-nav live in the
// client <AffiliateAdminChrome>, which hides itself on a single campaign's
// detail page (that screen is its own focused workspace).
export default function AffiliatesAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <AffiliateAdminChrome />
      {children}
    </div>
  );
}
