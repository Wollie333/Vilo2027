import { AffiliateShell } from "@/components/affiliate/AffiliateShell";

export const dynamic = "force-dynamic";

// Host entry to the affiliate program — inside the host dashboard shell, so a
// host reaches it without being thrown into the guest portal. Same program,
// gate, and screens as /portal/affiliates (shared via <AffiliateShell> + the
// re-exported page bodies); only the base path + breadcrumb differ.
export default function DashboardAffiliatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AffiliateShell basePath="/dashboard/affiliates" crumbLabel="Dashboard">
      {children}
    </AffiliateShell>
  );
}
