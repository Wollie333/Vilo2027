import type { Metadata } from "next";
import Link from "next/link";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";

export const metadata: Metadata = {
  title: "Account settings · Vilo",
};

// Guest-facing settings shell. Currently surfaces just notifications;
// more tabs (profile, payment methods) land in follow-ups. Keep chrome
// simple so the page is recognisable as a "settings" area without
// competing with the host dashboard styling.

const TABS = [
  { href: "/account/settings/notifications", label: "Notifications" },
];

export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BroadcastBanner />
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Manage how Vilo reaches you about your trips.
        </p>
      </header>
      <nav className="border-b border-brand-line">
        <ul role="tablist" className="-mb-px flex gap-1 overflow-x-auto pb-px">
          {TABS.map((t) => (
            <li key={t.href} role="presentation" className="shrink-0">
              <Link
                href={t.href}
                role="tab"
                className="relative flex items-center px-3 py-2.5 text-sm font-medium text-brand-ink"
              >
                {t.label}
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-t bg-brand-primary"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
