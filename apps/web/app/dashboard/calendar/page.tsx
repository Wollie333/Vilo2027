import type { Metadata } from "next";
import { Calendar as CalendarIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { signListingToken } from "@/lib/ical";
import { createServerClient } from "@/lib/supabase/server";

import { CalendarMonth } from "./CalendarMonth";
import { IcalExportPanel } from "./IcalExportPanel";
import { ListingPicker } from "./ListingPicker";

export const metadata: Metadata = {
  title: "Calendar · Vilo",
};

export const dynamic = "force-dynamic";

const MONTH_WINDOW = 3; // current + next 2

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonthN(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n + 1, 0);
}
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type RawBlock = {
  date: string;
  reason: string | null;
  booking_id: string | null;
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: { listing?: string };
}) {
  const supabase = createServerClient();

  // RLS host_manage_own_listings — only the host's rows.
  const { data: listings } = await supabase
    .from("listings")
    .select("id, name")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const selectedListing =
    listings && listings.length > 0
      ? (listings.find((l) => l.id === searchParams?.listing) ?? listings[0])
      : null;

  let blocksByIso: Map<string, RawBlock> = new Map();
  if (selectedListing) {
    const today = startOfMonth(new Date());
    const end = endOfMonthN(today, MONTH_WINDOW - 1);
    const { data: blocks } = await supabase
      .from("blocked_dates")
      .select("date, reason, booking_id")
      .eq("listing_id", selectedListing.id)
      .gte("date", isoDate(today))
      .lte("date", isoDate(end));
    blocksByIso = new Map((blocks ?? []).map((b) => [b.date, b as RawBlock]));
  }

  // Pre-compute the months to render.
  const now = new Date();
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < MONTH_WINDOW; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Booked + manually blocked dates for the next three months. Bookings
            block dates automatically.
          </p>
        </div>
        {listings && listings.length > 0 ? (
          <ListingPicker
            listings={listings}
            current={selectedListing?.id ?? ""}
          />
        ) : null}
      </header>

      {!listings || listings.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No listings yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Add a listing to start tracking availability.
          </p>
          <Link
            href="/dashboard/listings/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            New listing
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            {months.map((m) => (
              <CalendarMonth
                key={`${m.year}-${m.month}`}
                year={m.year}
                month={m.month}
                blocks={blocksByIso}
              />
            ))}
          </div>

          {selectedListing ? (
            <IcalExportPanel
              url={(() => {
                const h = headers();
                const proto = h.get("x-forwarded-proto") ?? "https";
                const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
                const token = signListingToken(selectedListing.id);
                return `${proto}://${host}/ical/${selectedListing.id}/${token}.ics`;
              })()}
            />
          ) : null}

          <div className="rounded-card border border-brand-line bg-white p-4 text-xs shadow-card">
            <div className="font-semibold text-brand-ink">Legend</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <LegendDot
                className="bg-brand-primary text-white"
                label="Booked"
              />
              <LegendDot
                className="bg-brand-line text-brand-mute"
                label="Manually blocked"
              />
              <LegendDot
                className="ring-2 ring-brand-dark"
                label="Today"
                ring
              />
              <span className="text-brand-mute">
                · Manual block / unblock from the editor lands later.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LegendDot({
  className,
  label,
  ring,
}: {
  className: string;
  label: string;
  ring?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${className} ${
          ring ? "bg-white" : ""
        }`}
      >
        {ring ? "" : "•"}
      </span>
      <span className="text-brand-dark">{label}</span>
    </span>
  );
}
