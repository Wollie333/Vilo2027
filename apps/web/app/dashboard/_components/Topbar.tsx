import { Plus } from "lucide-react";
import Link from "next/link";

import { AvatarMenu } from "./AvatarMenu";
import { EntitySearch } from "./EntitySearch";
import { NotificationBell } from "./notifications/NotificationBell";
import { VLogo } from "./VLogo";

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function Topbar({
  email,
  initials,
  avatarUrl = null,
}: {
  email: string;
  initials: string;
  avatarUrl?: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-line bg-brand-light/95 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-5 lg:px-8">
        {/* Mobile logo */}
        <a
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 lg:hidden"
        >
          <VLogo size={32} gradientId="topbar-mobile-logo" compact />
        </a>

        {/* Title block (desktop) */}
        <div className="hidden lg:block">
          <div className="text-[11px] font-medium text-brand-mute">
            {todayLabel()}
          </div>
          <h1 className="mt-0.5 font-display text-xl font-bold leading-none text-brand-ink">
            Dashboard
          </h1>
        </div>
        <div className="font-display text-base font-bold text-brand-ink lg:hidden">
          Dashboard
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Entity search */}
          <EntitySearch />

          {/* Notifications */}
          <NotificationBell />

          {/* New booking */}
          <Link
            href="/dashboard/bookings/new"
            className="hidden items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            New booking
          </Link>

          <AvatarMenu initials={initials} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
