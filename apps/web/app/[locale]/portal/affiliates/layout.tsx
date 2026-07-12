import { AffiliateShell } from "@/components/affiliate/AffiliateShell";

export const dynamic = "force-dynamic";

// Guest entry to the affiliate program — inside the guest portal shell. The
// content/gate/nav are shared with the host dashboard mount via <AffiliateShell>;
// only the base path + breadcrumb differ.
export default function AffiliatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AffiliateShell basePath="/portal/affiliates" crumbLabel="Portal">
      {children}
    </AffiliateShell>
  );
}
