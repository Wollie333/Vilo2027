"use client";

import { useState } from "react";

import { CopyLinkButton } from "./CopyLinkButton";

// "Products & your rates" — pixel-match of the design table with a client-side
// category filter. All money/rate values are computed server-side (real product
// config × tier bonus) and passed in; this only filters + renders.
export type RateRow = {
  id: string;
  ptype: "subscription" | "onceoff" | "service" | "package";
  name: string;
  subtitle: string;
  price: string;
  baseRate: string;
  yourRate: string;
  duration: { cls: string; label: string };
  youEarn: string;
  link: string;
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "subscription", label: "Subscriptions" },
  { key: "onceoff", label: "Once-off" },
  { key: "service", label: "Services" },
  { key: "package", label: "Packages" },
];

export function ProductRatesTable({
  rows,
  bonusNote,
}: {
  rows: RateRow[];
  bonusNote: string | null;
}) {
  const [filter, setFilter] = useState("all");
  const shown = rows.filter((r) => filter === "all" || r.ptype === filter);

  return (
    <section className="am-card fade mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line px-5 py-3.5">
        <div className="smallcaps">
          Products &amp; your rates · default program
        </div>
        <div className="flex items-center gap-3">
          <div className="seg">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={filter === f.key ? "on" : ""}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {bonusNote ? (
            <span className="tag gray">
              <span className="d" />
              {bonusNote}
            </span>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="ttable">
          <thead>
            <tr>
              <th>Product</th>
              <th className="r">Price</th>
              <th className="r">Base rate</th>
              <th className="r">Your rate</th>
              <th>Duration</th>
              <th className="r">You earn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-brand-mute">
                  No products in this category.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-semibold text-brand-ink">{r.name}</div>
                    <div className="text-[11.5px] text-brand-mute">
                      {r.subtitle}
                    </div>
                  </td>
                  <td className="num r">{r.price}</td>
                  <td className="num r">{r.baseRate}</td>
                  <td className="num r font-bold text-brand-secondary">
                    {r.yourRate}
                  </td>
                  <td>
                    <span className={`tag ${r.duration.cls}`}>
                      <span className="d" />
                      {r.duration.label}
                    </span>
                  </td>
                  <td className="num r font-semibold">{r.youEarn}</td>
                  <td className="r">
                    <CopyLinkButton value={r.link} className="btn-ghost h-8" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {bonusNote ? (
        <div className="border-t border-brand-line bg-brand-light/60 px-5 py-3 text-[11.5px] text-brand-mute">
          &ldquo;Your rate&rdquo; includes your tier bonus. Hosts referred
          through a campaign link earn that campaign&apos;s structure instead —
          tier bonuses don&apos;t apply there.
        </div>
      ) : null}
    </section>
  );
}
