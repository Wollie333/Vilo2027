"use client";

import { useState } from "react";

// CPA-safe "potential earnings" calculator (Founding Programme §4.7): the word
// "potential", conditional framing, illustrative — never "pending/estimated".
// Pure client math off a configurable per-host plan price + base rate passed in
// from the server (products config), so it stays in step with admin pricing.
function zar(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

export function EarningsCalculator({
  perHostPrice,
  ratePct,
  planLabel,
}: {
  perHostPrice: number;
  ratePct: number;
  planLabel: string;
}) {
  const [hosts, setHosts] = useState(25);
  const monthly = Math.round(hosts * perHostPrice * (ratePct / 100));

  return (
    <section className="am-card fade overflow-hidden">
      <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
        <span className="smallcaps">Potential earnings</span>
        <span className="tag gray">
          <span className="d" />
          Illustrative
        </span>
      </div>
      <div className="p-5">
        <label className="flabel" htmlFor="calcHosts">
          If you refer this many paying hosts…
        </label>
        <input
          id="calcHosts"
          type="range"
          min={1}
          max={100}
          value={hosts}
          onChange={(e) => setHosts(Number(e.target.value))}
          className="w-full accent-[#10B981]"
        />
        <div className="num mt-1 flex justify-between text-[11px] text-brand-mute">
          <span>1</span>
          <span className="text-[13px] font-bold text-brand-ink">
            {hosts} hosts
          </span>
          <span>100</span>
        </div>
        <div className="mt-4 rounded-[12px] border border-[#C7F0DC] bg-brand-light p-4 text-center">
          <div className="smallcaps">Potential monthly book</div>
          <div className="num mt-1 font-display text-[26px] font-extrabold text-brand-secondary">
            {zar(monthly)} / mo
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            at {ratePct}% of the {zar(perHostPrice)} {planLabel} plan
          </div>
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-brand-mute">
          Potential earnings only — illustrative, not guaranteed. Actual
          commission depends on the plans your referred hosts choose and keep.
          Earnings are conditional on hosts remaining subscribed.
        </p>
      </div>
    </section>
  );
}
