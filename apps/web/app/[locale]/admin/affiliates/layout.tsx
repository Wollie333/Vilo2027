import { AffiliateAdminNav } from "./_components/AffiliateAdminNav";

// Shared chrome for the admin affiliates area — the sub-tabs (Overview /
// Marketing / Terms / Programme settings) sit above every sub-route.
export default function AffiliatesAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AffiliateAdminNav />
      {children}
    </div>
  );
}
