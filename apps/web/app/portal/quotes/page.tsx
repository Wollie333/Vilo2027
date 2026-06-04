import type { Metadata } from "next";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Quotes",
};

export const dynamic = "force-dynamic";

// Guest-facing label + pill tint for each quote status.
const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: {
    label: "Being prepared",
    cls: "border-brand-line bg-brand-light text-brand-mute",
  },
  sent: {
    label: "Awaiting your reply",
    cls: "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
  },
  accepted: {
    label: "Accepted",
    cls: "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed",
  },
  converted: {
    label: "Booked",
    cls: "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed",
  },
  declined: {
    label: "Declined",
    cls: "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled",
  },
  expired: {
    label: "Expired",
    cls: "border-status-cancelled/30 bg-status-cancelled/5 text-status-cancelled",
  },
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalQuotesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS (guest_read_own_quotes) scopes this to the guest's own quotes.
  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, status, check_in, check_out, total_amount, currency, valid_until, created_at, listing:listings(name)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = (quotes ?? []).map((q) => {
    const expired =
      q.valid_until &&
      q.status === "sent" &&
      new Date(q.valid_until) < new Date();
    const effectiveStatus = expired ? "expired" : q.status;
    const listingName = Array.isArray(q.listing)
      ? q.listing[0]?.name
      : (q.listing as { name?: string } | null)?.name;
    return { ...q, effectiveStatus, listingName };
  });

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Quotes
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Custom quotes from hosts you&rsquo;ve enquired with. Review the
          details and accept to hold your dates.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-6 text-center">
          <p className="font-display text-base font-semibold text-brand-ink">
            No quotes yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Find a stay and tap &ldquo;Request a quote&rdquo; to ask a host for
            tailored pricing. Their reply lands here.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
          >
            Browse stays
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((q) => {
            const meta = STATUS_META[q.effectiveStatus] ?? STATUS_META.draft;
            return (
              <li key={q.id}>
                <Link
                  href={`/portal/quotes/${q.id}`}
                  className="block rounded-card border border-brand-line bg-white p-5 shadow-card transition hover:border-brand-primary/40 hover:shadow-lift"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${meta.cls}`}
                      >
                        {meta.label}
                      </span>
                      <div className="mt-2 flex items-center gap-2 font-display text-lg font-semibold text-brand-ink">
                        <FileText className="h-4 w-4 shrink-0 text-brand-mute" />
                        {q.listingName ?? "Your stay"}
                      </div>
                      <div className="mt-1 text-sm text-brand-mute">
                        {fmtDate(q.check_in)} → {fmtDate(q.check_out)}
                      </div>
                      <div className="mt-1 font-mono text-xs text-brand-mute">
                        {q.quote_number}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-brand-ink">
                        {formatMoney(q.total_amount, q.currency)}
                      </div>
                      <ArrowRight className="ml-auto mt-2 h-5 w-5 text-brand-mute" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
