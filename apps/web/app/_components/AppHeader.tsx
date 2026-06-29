import { Link } from "@/i18n/navigation";

import { VLogo } from "@/app/[locale]/dashboard/_components/VLogo";
import { BrandName } from "@/components/brand/BrandProvider";

import { HeaderMenuToggle } from "./SidebarToggle";

/**
 * Unified full-width top bar shared by the host dashboard, guest portal and
 * super-admin areas. Layout matches the "Classic shell" design:
 *
 *   [☰ menu] [logo · Wielo] ……… [ centered search ] ……… [ actions · avatar ]
 *
 * The three areas pass their own `search` and `actions` slots (entity search,
 * notification bell, primary CTA, avatar menu) but every pixel of the frame is
 * identical, so all three portals read as one product.
 */
export function AppHeader({
  brandHref = "/dashboard",
  search,
  actions,
}: {
  brandHref?: string;
  search?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-brand-line bg-white px-4 lg:px-5">
      <HeaderMenuToggle />

      <Link href={brandHref} className="flex shrink-0 items-center gap-2.5">
        <VLogo size={36} gradientId="app-header-logo" />
        <span className="hidden font-display text-[17px] font-bold tracking-tight text-brand-ink sm:block">
          <BrandName />
        </span>
      </Link>

      {search ? (
        <div className="mx-auto flex max-w-2xl flex-1 items-center justify-center">
          {search}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
    </header>
  );
}
