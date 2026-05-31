import type { Metadata } from "next";
import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My trips · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  confirmed:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  completed:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  checked_in:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  pending: "bg-status-pending/10 text-status-pending border-status-pending/30",
  pending_eft:
    "bg-status-pending/10 text-status-pending border-status-pending/30",
  cancelled_by_guest:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  cancelled_by_host:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  expired: "bg-brand-light text-brand-mute border-brand-line",
};

type Row = {
  id: string;
  reference: string;
  status: string;
  payment_status: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  guests_count: number;
  total_amount: number;
  currency: string;
  created_at: string;
  listing:
    | { name: string; slug: string | null }
    | { name: string; slug: string | null }[]
    | null;
  host:
    | { handle: string; display_name: string }
    | { handle: string; display_name: string }[]
    | null;
};

export default async function PortalTripsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("bookings")
    .select(
      `
      id, reference, status, payment_status,
      check_in, check_out, nights,
      guests_count, total_amount, currency,
      created_at,
      listing:listings ( name, slug ),
      host:hosts ( handle, display_name )
    `,
    )
    .eq("guest_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const list = (rows as Row[] | null) ?? [];
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const isUpcoming = (b: Row): boolean => {
    if (
      !["confirmed", "checked_in", "pending", "pending_eft"].includes(b.status)
    ) {
      return false;
    }
    return (b.check_out ?? "") >= todayIso;
  };
  const upcoming = list.filter(isUpcoming);
  const past = list.filter((b) => !upcoming.includes(b));

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          My trips
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Every booking you&apos;ve made with a Vilo host.
        </p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <p className="font-display text-lg font-bold text-brand-ink">
            No trips yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Browse the directory and book a place — your trips will appear here.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
          >
            Browse Vilo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <Section title="Upcoming" rows={upcoming} />
          ) : null}
          {past.length > 0 ? <Section title="Past" rows={past} /> : null}
        </>
      )}
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 font-display text-base font-semibold text-brand-ink">
        {title}{" "}
        <span className="font-mono text-brand-mute">({rows.length})</span>
      </h2>
      <div className="space-y-3">
        {rows.map((b) => {
          const listing = Array.isArray(b.listing) ? b.listing[0] : b.listing;
          const host = Array.isArray(b.host) ? b.host[0] : b.host;
          const statusCls =
            STATUS_STYLES[b.status] ??
            "bg-brand-light text-brand-mute border-brand-line";
          return (
            <article
              key={b.id}
              className="rounded-card border border-brand-line bg-white p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium ${statusCls}`}
                    >
                      {b.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-[11px] text-brand-mute">
                      {b.reference}
                    </span>
                  </div>
                  <div className="mt-2 font-display text-base font-semibold text-brand-ink">
                    {listing?.name ?? "Listing"}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-brand-mute">
                    {host?.display_name
                      ? `Hosted by ${host.display_name} · `
                      : ""}
                    {`${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}${
                      b.nights
                        ? ` · ${b.nights} ${b.nights === 1 ? "night" : "nights"}`
                        : ""
                    }`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-lg font-bold text-brand-ink">
                    {fmtR(Number(b.total_amount), b.currency)}
                  </div>
                  <Link
                    href={`/my-trips/${b.id}`}
                    className="mt-2 inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                  >
                    View
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
