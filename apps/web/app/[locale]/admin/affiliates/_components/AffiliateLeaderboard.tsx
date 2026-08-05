"use client";

import { ArrowDown, ArrowUp, Copy, Medal, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

export type LeaderboardRow = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  email: string | null;
  status: "pending" | "active" | "suspended";
  currency: string;
  clicks: number;
  referrals: number;
  campaignReferrals: number;
  lifetime: number;
  available: number;
};

type SortKey = "referrals" | "lifetime" | "clicks" | "available";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "clicks", label: "Clicks" },
  { key: "referrals", label: "Referrals" },
  { key: "lifetime", label: "Lifetime earned" },
  { key: "available", label: "Available" },
];

// Universal, live lifetime leaderboard of EVERY affiliate on the system — default
// and competition alike (they share affiliate_accounts; campaignReferrals just
// flags how many of their referrals came through a competition link). Sortable;
// each row drills into that affiliate's full record.
export function AffiliateLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("referrals");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [q, setQ] = useState("");

  const ranked = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            (r.email ?? "").toLowerCase().includes(needle) ||
            r.slug.toLowerCase().includes(needle),
        )
      : rows;
    const sorted = [...filtered].sort((a, b) => {
      const d = a[sort] - b[sort];
      return dir === "desc" ? -d : d;
    });
    return sorted;
  }, [rows, sort, dir, q]);

  const topReferrer = useMemo(
    () => [...rows].sort((a, b) => b.referrals - a.referrals)[0] ?? null,
    [rows],
  );
  const topEarner = useMemo(
    () => [...rows].sort((a, b) => b.lifetime - a.lifetime)[0] ?? null,
    [rows],
  );

  function toggle(key: SortKey) {
    if (sort === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(key);
      setDir("desc");
    }
  }

  return (
    <div className="space-y-4">
      {/* Highlights */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Highlight
          label="Top referrer (lifetime)"
          name={topReferrer?.name ?? "—"}
          value={topReferrer ? `${topReferrer.referrals} referrals` : "—"}
        />
        <Highlight
          label="Top earner (lifetime)"
          name={topEarner?.name ?? "—"}
          value={
            topEarner
              ? formatMoney(topEarner.lifetime, topEarner.currency)
              : "—"
          }
        />
      </div>

      <section className="am-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line px-5 py-3.5">
          <div>
            <div className="smallcaps">All affiliates</div>
            <p className="mt-0.5 text-[11.5px] text-brand-mute">
              Every affiliate ever — default and competition. {rows.length}{" "}
              total.
            </p>
          </div>
          <label className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email or link"
              className="h-9 w-[220px] max-w-full rounded-[10px] border border-brand-line bg-white pl-8 pr-3 text-[12.5px] outline-none focus:border-brand-secondary"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Affiliate</th>
                <th>Partner code</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="r">
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={`inline-flex items-center gap-1 hover:text-brand-ink ${
                        sort === c.key ? "text-brand-ink" : ""
                      }`}
                    >
                      {c.label}
                      {sort === c.key ? (
                        dir === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : null}
                    </button>
                  </th>
                ))}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-brand-mute">
                    No affiliates found.
                  </td>
                </tr>
              ) : (
                ranked.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/affiliates/${r.id}`)}
                    className="cursor-pointer hover:bg-brand-light"
                  >
                    <td className="num text-brand-mute">
                      {i < 3 ? (
                        <Medal
                          className={`h-4 w-4 ${
                            i === 0
                              ? "text-[#D4A017]"
                              : i === 1
                                ? "text-[#9CA3AF]"
                                : "text-[#B45309]"
                          }`}
                        />
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                          {r.name}
                        </div>
                        <div className="mono truncate text-[11px] text-brand-mute">
                          /r/{r.slug}
                          {r.email ? ` · ${r.email}` : ""}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-1.5">
                        <span className="mono text-[12.5px] font-semibold text-brand-ink">
                          {r.slug}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(r.slug).then(
                              () => toast.success("Partner code copied"),
                              () => toast.error("Couldn't copy."),
                            );
                          }}
                          aria-label="Copy partner code"
                          className="rounded border border-brand-line bg-white p-1 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="num r text-brand-ink">{r.clicks}</td>
                    <td className="num r text-brand-ink">
                      {r.referrals}
                      {r.campaignReferrals > 0 ? (
                        <span
                          className="ml-1 text-[10px] text-brand-secondary"
                          title={`${r.campaignReferrals} via a competition link`}
                        >
                          ({r.campaignReferrals} comp)
                        </span>
                      ) : null}
                    </td>
                    <td className="num r font-semibold text-brand-ink">
                      {formatMoney(r.lifetime, r.currency)}
                    </td>
                    <td className="num r text-brand-mute">
                      {formatMoney(r.available, r.currency)}
                    </td>
                    <td>
                      <span
                        className={`tag ${
                          r.status === "active"
                            ? "green"
                            : r.status === "pending"
                              ? "amber"
                              : "red"
                        }`}
                      >
                        <span className="d" />
                        {r.status === "active"
                          ? "Active"
                          : r.status === "pending"
                            ? "Pending"
                            : "Suspended"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Highlight({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="am-card flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-brand-line bg-brand-light">
        <Medal className="h-[18px] w-[18px] text-brand-secondary" />
      </div>
      <div className="min-w-0">
        <div className="smallcaps">{label}</div>
        <div className="truncate text-[14px] font-semibold text-brand-ink">
          {name}
        </div>
        <div className="text-[12px] text-brand-mute">{value}</div>
      </div>
    </div>
  );
}
