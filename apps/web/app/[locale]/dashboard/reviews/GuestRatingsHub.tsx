"use client";

import { ArrowRight, Lock, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";

import { StarRow } from "./StarRow";

export type GuestRatingHubRow = {
  id: string;
  /** u_<guest_id> — links to the guest record's Reputation tab. */
  gkey: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  rating: number;
  summary: string | null;
  updatedAt: string;
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Private hub of the host's OWN ratings of guests (host → guest reputation).
 * Guests never see these. Each row links to that guest's record (Reputation tab)
 * where the host can edit or delete the rating — the single place that owns it.
 */
export function GuestRatingsHub({ rows }: { rows: GuestRatingHubRow[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          (r.email ?? "").toLowerCase().includes(query) ||
          (r.summary ?? "").toLowerCase().includes(query),
      )
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-[12.5px] text-brand-mute">
          <Lock className="h-3.5 w-3.5" />
          Private — your ratings of guests. Guests never see these.{" "}
          <span className="font-semibold text-brand-ink">
            {rows.length} rated
          </span>
          .
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a guest…"
            className="w-56 rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 text-[12.5px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-brand-mute/50" />
          <p className="mt-2 text-[13px] font-semibold text-brand-ink">
            You haven&rsquo;t rated any guests yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-brand-mute">
            Open a guest&rsquo;s record and use the <strong>Reputation</strong>{" "}
            tab to rate them after a completed stay.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-10 text-center text-[13px] text-brand-mute">
          No guests match &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="divide-y divide-brand-line overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/guests/${r.gkey}?tab=reputation`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-light/50"
            >
              {r.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.avatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-brand-line"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[12px] font-bold text-white">
                  {initials(r.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                  {r.name}
                </div>
                <div className="truncate text-[12px] text-brand-mute">
                  {r.summary || "No written summary"}
                </div>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 sm:inline-flex">
                <StarRow rating={r.rating} />
                <span className="num w-7 text-right text-[13px] font-bold tabular-nums text-brand-ink">
                  {r.rating.toFixed(1)}
                </span>
              </span>
              <span className="hidden shrink-0 text-[11.5px] text-brand-mute md:inline">
                {fmtDate(r.updatedAt)}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-brand-primary">
                Edit <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
