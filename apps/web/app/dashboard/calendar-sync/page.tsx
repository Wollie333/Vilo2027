import type { Metadata } from "next";
import { ExternalLink, RotateCw } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Calendar sync · Vilo",
};

export default function CalendarSyncPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Calendar sync
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Two-way iCal between Vilo and Airbnb / Booking.com / Google / Apple.
          Half of it&rsquo;s live.
        </p>
      </header>

      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <RotateCw className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-brand-ink">
              Export — live now
            </div>
            <p className="mt-1 text-sm text-brand-mute">
              Every listing has a per-listing iCal URL you can paste into other
              calendars. Find it under each listing on the Calendar page.
            </p>
            <Link
              href="/dashboard/calendar"
              className="mt-3 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              Open Calendar
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-dashed border-brand-line bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-line text-brand-mute">
            <RotateCw className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-brand-ink">
              Import — coming in Phase 2
            </div>
            <p className="mt-1 text-sm text-brand-mute">
              Add an Airbnb or Booking.com calendar URL and Vilo will block
              those dates automatically. 15-minute re-sync, conflict detection,
              host alerts on broken feeds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
