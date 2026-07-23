import { formatMoneyExact } from "@/lib/format";
import type { CampaignMetrics } from "@/lib/affiliate/metrics";
import {
  FunnelStrip,
  KindBreakdown,
  Sparkline,
  StatBand,
  StatTile,
} from "@/components/affiliate/metrics-ui";

// The campaign "Metrics" tab body. Read-only projection of the campaign's real
// performance: attribution funnel, commission position (the same signed-row
// derivation the balances use), the daily live-listing trend, and a per-partner
// table. Passed the loaded metrics; renders nothing that isn't measured.
export function CampaignMetricsPanel({
  metrics,
}: {
  metrics: CampaignMetrics;
}) {
  const { funnel, balance, byKind, trend, partners } = metrics;
  const cur = balance.currency;

  return (
    <div className="space-y-6">
      {/* ── Attribution funnel ── */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="smallcaps">Attribution funnel</div>
          <div className="text-[11.5px] text-brand-mute">
            Clicks on this campaign&apos;s links, all the way to a paying host
          </div>
        </div>
        <FunnelStrip
          steps={[
            { label: "Clicks", value: funnel.clicks, hint: "campaign links" },
            { label: "Referred", value: funnel.referrals },
            { label: "Became hosts", value: funnel.hosts },
            { label: "Listed", value: funnel.listedHosts },
            { label: "Paying", value: funnel.payingHosts },
          ]}
        />
      </section>

      {/* ── Commission position ── */}
      <section>
        <div className="smallcaps mb-2">Commission earned here</div>
        <StatBand>
          <StatTile
            label="Lifetime (net)"
            value={formatMoneyExact(balance.lifetime, cur)}
            sub="all non-voided rows"
            tone="primary"
          />
          <StatTile
            label="In hold"
            value={formatMoneyExact(balance.pending, cur)}
            sub="pending clear"
          />
          <StatTile
            label="Available"
            value={formatMoneyExact(balance.available, cur)}
            sub="withdrawable"
          />
          <StatTile
            label="Paid out"
            value={formatMoneyExact(balance.paid, cur)}
            sub={
              balance.clawedBack > 0
                ? `${formatMoneyExact(balance.clawedBack, cur)} clawed back`
                : "settled"
            }
          />
        </StatBand>
      </section>

      {/* ── Kind breakdown + scoring trend ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="am-card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps">By commission type</div>
          </div>
          <KindBreakdown rows={byKind} currency={cur} />
        </section>

        <section className="am-card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps">Live listings over time</div>
            <p className="mt-0.5 text-[11.5px] text-brand-mute">
              The daily score snapshot — the campaign&apos;s total live
              listings.
            </p>
          </div>
          <Sparkline points={trend} />
        </section>
      </div>

      {/* ── Per-partner performance ── */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Partner performance</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Referrals brought in, live listings scored, and commission earned —
            under this campaign only.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th className="r">Referrals</th>
                <th className="r">Live listings</th>
                <th className="r">Earned</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-brand-mute">
                    No partner activity on this campaign yet.
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.affiliateId}>
                    <td>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                          {p.name}
                        </div>
                        <div className="mono truncate text-[11px] text-brand-mute">
                          /r/{p.slug}
                        </div>
                      </div>
                    </td>
                    <td className="num r text-brand-ink">{p.referrals}</td>
                    <td className="num r font-semibold text-brand-ink">
                      {p.liveListings}
                    </td>
                    <td
                      className={`num r font-semibold ${p.earned < 0 ? "text-red-600" : "text-brand-primary"}`}
                    >
                      {formatMoneyExact(p.earned, p.currency)}
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
