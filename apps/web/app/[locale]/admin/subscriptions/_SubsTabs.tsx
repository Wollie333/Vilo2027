"use client";

import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import { usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/admin/subscriptions", label: "Hosts", exact: true },
  { href: "/admin/subscriptions/customers", label: "Customers", exact: false },
  { href: "/admin/subscriptions/products", label: "Products", exact: false },
  { href: "/admin/subscriptions/revenue", label: "Revenue", exact: false },
] as const;

/**
 * Tab strip across the admin subscription console. Uses the shared `RecordTabs`
 * underline bar so it matches the rest of the platform — it previously
 * hand-rolled its own underline (border-b-2, py-2.5, brand-primary text) which
 * read heavier and sat differently to every other tab strip.
 */
export function SubsTabs() {
  // next-intl's usePathname already returns the pathname without the locale
  // prefix, so the hand-rolled regex strip isn't needed.
  const path = usePathname();

  const activeHref =
    TABS.find((t) => (t.exact ? path === t.href : path.startsWith(t.href)))
      ?.href ?? TABS[0].href;

  return (
    <RecordTabs
      tabs={TABS.map((t) => ({ key: t.href, label: t.label, href: t.href }))}
      active={activeHref}
    />
  );
}
