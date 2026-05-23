import { Bell, Calendar, ChevronDown, Plus, Search } from "lucide-react";

import { AvatarMenu } from "./AvatarMenu";
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
}: {
  email: string;
  initials: string;
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
          {/* Search */}
          <button
            type="button"
            className="hidden items-center gap-2 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-mute transition-shadow hover:shadow-card md:flex"
          >
            <Search className="h-4 w-4" />
            <span className="hidden xl:inline">
              Search bookings, guests, listings…
            </span>
            <span className="xl:hidden">Search</span>
            <kbd className="ml-2 hidden rounded border border-brand-line bg-brand-light px-1.5 py-0.5 font-mono text-[10px] text-brand-mute xl:inline-block">
              ⌘K
            </kbd>
          </button>

          {/* Date range */}
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-light md:flex"
          >
            <Calendar className="h-4 w-4 text-brand-primary" />
            <span>This month</span>
            <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
          </button>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
          >
            <span className="relative inline-flex">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-status-cancelled ring-2 ring-white" />
            </span>
          </button>

          {/* New booking */}
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            New booking
          </button>

          <AvatarMenu initials={initials} email={email} />
        </div>
      </div>
    </header>
  );
}
