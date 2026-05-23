import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payments · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function methodLabel(m: string): string {
  if (m === "paystack") return "Paystack";
  if (m === "paypal") return "PayPal";
  if (m === "eft") return "Manual EFT";
  return m;
}

const STATUS_TONES: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  authorised: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-indigo-100 text-indigo-800",
  partially_refunded: "bg-indigo-100 text-indigo-800",
  voided: "bg-slate-100 text-slate-700",
};

function fmtDt(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function PaymentsPage() {
  const supabase = createServerClient();

  // RLS host_read_own_payments — only payments for this host's bookings.
  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, method, status, provider_reference, captured_at, created_at, booking:bookings!inner ( id, reference, listing:listings!inner ( name ) )",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const collected = (payments ?? [])
    .filter((p) => p.status === "completed")
    .reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Payments
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Every payment for every booking across your listings. Money settles
          directly to your provider account.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <KpiTile
          label="Collected"
          value={fmtR(collected, "ZAR")}
          sub={`${(payments ?? []).filter((p) => p.status === "completed").length} payments`}
        />
        <KpiTile
          label="Pending"
          value={String(
            (payments ?? []).filter((p) => p.status === "pending").length,
          )}
          sub="awaiting webhook"
        />
        <KpiTile
          label="Failed"
          value={String(
            (payments ?? []).filter((p) => p.status === "failed").length,
          )}
          sub="not your fault"
        />
      </section>

      {!payments || payments.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            No payments yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Once a guest pays, every charge will appear here with its provider
            reference and status.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-brand-light/60 text-left text-[10px] uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provider ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {payments.map((p) => {
                const booking = p.booking as unknown as {
                  id: string;
                  reference: string;
                  listing: { name: string };
                };
                const tone =
                  STATUS_TONES[p.status] ?? "bg-brand-line text-brand-mute";
                return (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-brand-light"
                  >
                    <td className="px-4 py-3 align-top text-xs text-brand-dark">
                      {fmtDt(p.captured_at ?? p.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/dashboard/bookings/${booking.id}`}
                        className="font-mono text-xs font-medium text-brand-primary hover:underline"
                      >
                        {booking.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="truncate text-brand-ink">
                        {booking.listing.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-brand-dark">
                      {methodLabel(p.method)}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="font-display font-bold text-brand-ink">
                        {fmtR(Number(p.amount), p.currency)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                      >
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="font-mono text-[10px] text-brand-mute">
                        {p.provider_reference?.slice(0, 14) ?? "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-brand-mute">
        Refunds + manual payout reconciliation land in Phase 3 with the Refund
        Manager.
      </p>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-2 font-display text-2xl font-bold text-brand-ink">
        {value}
      </div>
      <div className="mt-1 text-xs text-brand-mute">{sub}</div>
    </div>
  );
}
