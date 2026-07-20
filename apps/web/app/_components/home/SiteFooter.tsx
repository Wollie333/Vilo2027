import { getTranslations } from "next-intl/server";

import {
  getBrandName,
  getCompanyLegalName,
  getCompanyLocation,
} from "@/lib/brand";
import { Link } from "@/i18n/navigation";

import { VLogo } from "./VLogo";

const EXPLORE = [
  { href: "#destinations", key: "exploreDestinations" },
  { href: "#types", key: "explorePropertyTypes" },
  { href: "#deals", key: "exploreDeals" },
  { href: "#", key: "exploreGroupStays" },
  { href: "#", key: "exploreGiftCards" },
] as const;

const GUESTS = [
  { href: "/login", key: "guestsSignIn" },
  { href: "/my-trips", key: "guestsMyTrips" },
  { href: "/help", key: "guestsHelpCentre" },
  { href: "/terms", key: "guestsRefundPolicy" },
  { href: "/help", key: "guestsCancelBooking" },
] as const;

const HOSTS = [
  // "For hosts" (/booking-management) is hidden for now — point host links at
  // the signup flow and drop the deep anchors into the removed page.
  { href: "/signup/host", key: "hostsList" },
  { href: "/help", key: "hostsAcademy" },
  { href: "/help", key: "hostsMigration" },
] as const;

const COMPANY = [
  { href: "/about", key: "companyAbout" },
  { href: "/build", key: "companyBuildBoard" },
  { href: "/change-log", key: "companyChangelog" },
  { href: "/contact", key: "companyContact" },
  { href: "/privacy", key: "companyPrivacy" },
  { href: "/terms", key: "companyTerms" },
] as const;

export async function SiteFooter() {
  const [brand, companyName, companyLocation, t] = await Promise.all([
    getBrandName(),
    getCompanyLegalName(),
    getCompanyLocation(),
    getTranslations("footer"),
  ]);
  const year = new Date().getFullYear();
  // Translate a column's links (brand passed for keys like "How {brand} works").
  const toLinks = (
    arr: ReadonlyArray<{ href: string; key: string }>,
  ): Array<{ href: string; label: string }> =>
    arr.map((l) => ({ href: l.href, label: t(l.key, { brand }) }));
  return (
    <footer className="bg-brand-dark text-brand-accent/80">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <VLogo size={32} gradientId="home-footer-logo" />
              <span className="font-display text-[17px] font-bold tracking-tight text-white">
                {brand}
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              {t("tagline")}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="X"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M18.244 2H21l-6.52 7.45L22 22h-6.781l-5.32-6.957L3.8 22H1.04l6.974-7.969L1.5 2h6.96l4.81 6.36L18.244 2zm-2.376 18h1.875L7.21 4H5.197L15.868 20z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterColumn title={t("colExplore")} links={toLinks(EXPLORE)} />
          <FooterColumn title={t("colGuests")} links={toLinks(GUESTS)} />
          <FooterColumn title={t("colHosts")} links={toLinks(HOSTS)} />
          <FooterColumn title={t("colCompany")} links={toLinks(COMPANY)} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs md:flex-row md:items-center">
          <div>
            © {year} {companyName} · {companyLocation}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:ml-auto">
            <Link href="/terms" className="hover:text-white">
              {t("bottomTerms")}
            </Link>
            <Link href="/privacy" className="hover:text-white">
              {t("bottomPrivacy")}
            </Link>
            <Link href="/dashboard/settings/data" className="hover:text-white">
              {t("bottomPopia")}
            </Link>
            <Link href="/cookies" className="hover:text-white">
              {t("bottomCookies")}
            </Link>
            <Link
              href="/change-log"
              className="inline-flex items-center gap-1.5 font-mono hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              {t("systemsOperational")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div className="md:col-span-2">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
        {title}
      </div>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
