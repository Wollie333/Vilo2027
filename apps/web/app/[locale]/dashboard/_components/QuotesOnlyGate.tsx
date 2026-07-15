"use client";

import { Lock, MessageSquare, Sparkles } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { isQuotesOnlyAllowedPath } from "@/lib/host/accountScope";

// Friendly section names for the lock headline, keyed by the dashboard path
// prefix. Falls back to a prettified segment for anything unlisted.
const SECTION_LABEL: Record<string, string> = {
  "/dashboard/properties": "Listings",
  "/dashboard/rooms": "Rooms",
  "/dashboard/calendar": "the Calendar",
  "/dashboard/bookings": "Bookings",
  "/dashboard/website": "the Website builder",
  "/dashboard/calendar-sync": "Calendar sync",
  "/dashboard/payments": "Payments",
  "/dashboard/ledger": "the Ledger",
  "/dashboard/invoices": "Invoices",
  "/dashboard/credit-notes": "Credit notes",
  "/dashboard/refunds": "Refunds",
  "/dashboard/policies": "Policies",
  "/dashboard/specials": "Specials",
  "/dashboard/addons": "Add-ons",
  "/dashboard/coupons": "Coupons",
  "/dashboard/reviews": "Reviews",
  "/dashboard/media": "the Media library",
  "/dashboard/reports": "Reports",
  "/dashboard/tracking": "Tracking",
  "/dashboard/affiliates": "Affiliates",
};

function sectionLabel(pathname: string): string {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");
  for (const [prefix, label] of Object.entries(SECTION_LABEL)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return label;
  }
  const seg = path.split("/")[2] ?? "this";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

/**
 * Quotes-only route gate. A quotes-only (Wielo Quotes / R99) account may open
 * the whole host IA from the sidebar, but any host-only surface renders this
 * upgrade lock INSTEAD of the page — so they see what a full host account
 * unlocks and how to upgrade, rather than being silently bounced.
 *
 * This is a UX surface only; the security boundary is enforced server-side
 * (host-only Server Actions reject a quotes-only account — see
 * lib/host/assertFullHost).
 */
export function QuotesOnlyGate({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (active && !isQuotesOnlyAllowedPath(pathname)) {
    return <UpgradeLockScreen label={sectionLabel(pathname)} />;
  }
  return <>{children}</>;
}

function UpgradeLockScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-xl font-bold text-brand-ink">
          {label} is a full host feature
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-brand-mute">
          Your{" "}
          <span className="font-semibold text-brand-ink">Wielo Quotes</span>{" "}
          plan covers Looking-For requests, quotes, credits, your inbox and
          guests. Upgrade to a full host account to unlock listings, bookings,
          the calendar, payments and your own booking website.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            href="/dashboard/inbox"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-pill bg-brand-primary px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
          >
            <MessageSquare className="h-4 w-4" />
            Message Wielo to upgrade
          </Link>
          <Link
            href="/dashboard/looking-for"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-pill border border-brand-line bg-white px-5 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
          >
            <Sparkles className="h-4 w-4" />
            Back to my quotes
          </Link>
        </div>
      </div>
    </div>
  );
}
