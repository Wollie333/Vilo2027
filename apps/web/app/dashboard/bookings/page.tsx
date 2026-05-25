import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import { StatusFilter } from "./StatusFilter";
import { StatusPill } from "./StatusPill";

export const metadata: Metadata = {
  title: "Bookings · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

const CANCELLED_STATUSES = [
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
] as const;

function statusFilterClause(status: string | undefined) {
  if (!status) return null;
  if (status === "cancelled")
    return { kind: "in" as const, values: [...CANCELLED_STATUSES] };
  return { kind: "eq" as const, value: status };
}

export default async function BookingsListPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const supabase = createServerClient();

  // RLS host_manage_own_bookings — only this host's bookings.
  const baseQuery = () =>
    supabase
      .from("bookings")
      .select(
        "id, reference, status, payment_status, scope, origin, guest_name, guest_email, check_in, check_out, nights, session_date, guests_count, total_amount, currency, created_at, listing:listings!inner ( name, listing_type ), guest:user_profiles!left ( full_name, email ), booking_rooms ( id )",
      )
      .order("created_at", { ascending: false });

  const filter = statusFilterClause(searchParams?.status);
  let query = baseQuery();
  if (filter?.kind === "eq") query = query.eq("status", filter.value);
  if (filter?.kind === "in") query = query.in("status", filter.values);

  const [{ data: bookings }, { data: allForCounts }] = await Promise.all([
    query.limit(50),
    supabase.from("bookings").select("status"),
  ]);

  const counts: Record<string, number> = { "": (allForCounts ?? []).length };
  for (const row of allForCounts ?? []) {
    const s = row.status as string;
    if ((CANCELLED_STATUSES as readonly string[]).includes(s)) {
      counts["cancelled"] = (counts["cancelled"] ?? 0) + 1;
    } else {
      counts[s] = (counts[s] ?? 0) + 1;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Every reservation across your listings. Guests can pay here; you
            confirm here.
          </p>
        </div>
        <Link
          href="/dashboard/bookings/new"
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
        >
          New booking
        </Link>
      </header>

      <StatusFilter counts={counts} />

      {!bookings || bookings.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No bookings yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Once a guest reserves and pays, the booking will show up here for
            you to confirm.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-brand-light/60 text-left text-[10px] uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {bookings.map((b) => {
                const guest = b.guest as unknown as {
                  full_name: string | null;
                  email: string | null;
                } | null;
                const guestLabel =
                  guest?.full_name ||
                  b.guest_name ||
                  guest?.email ||
                  b.guest_email ||
                  "—";
                const listing = b.listing as unknown as {
                  name: string;
                  listing_type: "accommodation" | "experience";
                };
                const isExperience = listing.listing_type === "experience";
                const sessionLabel =
                  isExperience && b.session_date
                    ? new Date(b.session_date).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null;
                return (
                  <tr
                    key={b.id}
                    className="transition-colors hover:bg-brand-light"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/dashboard/bookings/${b.id}`}
                        className="font-mono text-xs font-medium text-brand-primary hover:underline"
                      >
                        {b.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-brand-ink">
                        {guestLabel}
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        {b.guests_count}{" "}
                        {isExperience
                          ? b.guests_count === 1
                            ? "person"
                            : "people"
                          : b.guests_count === 1
                            ? "guest"
                            : "guests"}
                        {b.origin === "host_manual"
                          ? " · Manual"
                          : b.origin === "quote_converted"
                            ? " · From quote"
                            : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="truncate font-medium text-brand-ink">
                        {listing.name}
                      </div>
                      {isExperience ? (
                        <div className="mt-0.5 text-[11px] text-brand-mute">
                          Experience
                        </div>
                      ) : b.scope === "rooms" ? (
                        <div className="mt-0.5 text-[11px] text-brand-mute">
                          {(b.booking_rooms as Array<{ id: string }> | null)
                            ?.length ?? 0}{" "}
                          {((b.booking_rooms as Array<{ id: string }> | null)
                            ?.length ?? 0) === 1
                            ? "room"
                            : "rooms"}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isExperience ? (
                        <div className="text-brand-ink">
                          {sessionLabel ?? "—"}
                        </div>
                      ) : (
                        <>
                          <div className="text-brand-ink">
                            {b.check_in ?? "—"}
                          </div>
                          <div className="text-[11px] text-brand-mute">
                            → {b.check_out ?? "—"}
                            {b.nights != null
                              ? ` · ${b.nights} ${b.nights === 1 ? "night" : "nights"}`
                              : ""}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="font-medium text-brand-ink">
                        {fmtR(Number(b.total_amount), b.currency)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-brand-mute">
                        {b.payment_status}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusPill status={b.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
