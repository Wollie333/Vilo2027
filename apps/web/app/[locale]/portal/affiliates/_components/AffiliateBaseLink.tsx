"use client";

import { Link, usePathname } from "@/i18n/navigation";

// A link to a sibling affiliate route that resolves against whichever base the
// affiliate area is mounted under (/portal/affiliates for guests,
// /dashboard/affiliates for hosts) — so cross-links keep the user in their shell.
export function AffiliateBaseLink({
  suffix,
  className,
  children,
}: {
  suffix: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = pathname.startsWith("/dashboard/affiliates")
    ? "/dashboard/affiliates"
    : "/portal/affiliates";
  return (
    <Link href={`${base}${suffix}`} className={className}>
      {children}
    </Link>
  );
}
