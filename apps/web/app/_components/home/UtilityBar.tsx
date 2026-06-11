import { ChevronDown, Globe, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function UtilityBar() {
  return (
    <div className="hidden bg-brand-dark text-brand-accent/80 md:block">
      <div className="mx-auto flex h-9 max-w-7xl items-center gap-6 px-5 text-[12px] lg:px-8">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
          Direct bookings · zero commission to guests
        </span>
        <div className="ml-auto flex items-center gap-5">
          {/* Language picker becomes real in L-B (i18n). Currency switching lives
              in SiteHeader's CurrencySwitcher — the single canonical control. */}
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            <Globe className="h-3.5 w-3.5" />
            English (SA)
            <ChevronDown className="h-3 w-3" />
          </button>
          <Link
            href="/booking-management"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            <KeyRound className="h-3.5 w-3.5" />
            List your property
          </Link>
          <a href="#" className="hover:text-white">
            Help
          </a>
        </div>
      </div>
    </div>
  );
}
