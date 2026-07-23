import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { loadProgramMetrics } from "@/lib/affiliate/metrics";
import { formatMoneyExact } from "@/lib/format";
import {
  FunnelStrip,
  KindBreakdown,
  StatBand,
  StatTile,
} from "@/components/affiliate/metrics-ui";

export const dynamic = "force-dynamic";

const CAMPAIGN_STATUS: Record<string, string> = {
  active: "green",
  draft: "gray",
  ended: "amber",
  archived: "red",
};

// Program-wide affiliate analytics — the whole programme (every campaign + the
// default programme) in one place. Read-only; commission figures reuse the
// signed-row balance derivation, funnel counts come from the SECDEF RPC.
export default async function AffiliateMetricsPage() {
  await requirePermission("subscriptions.edit");
  const m = await loadProgramMetrics();
  const cur = m.balance.currency;

  return (
    <div className="space-y-8">
      {/* ── Headline ── */}
      <section>
        <div className="smallcaps mb-2">Programme at a glance</div>
        <StatBand>
          <StatTile
            label="Active partners"
            value={m.funnel.activePartners.toLocaleString("en-ZA")}
            sub="live affiliates"
          />
          <StatTile
            label="Referred users"
            value={m.funnel.referrals.toLocaleString("en-ZA")}
            sub={`${m.funnel.payingHosts} paying`}
          />
          <StatTile
            label="Live listings"
            value={m.funnel.liveListings.toLocaleString("en-ZA")}
            sub="from referred hosts"
          />
          <StatTile
            label="Lifetime commission"
            value={formatMoneyExact(m.balance.lifetime, cur)}
            sub="net earned, all time"
            tone="primary"
          />
        </StatBand>
      </section>

      {/* ── Funnel ── */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="smallcaps">Attribution funnel</div>
          <div className="text-[11.5px] text-brand-mute">
            Every referral, campaign or default programme
          </div>
        </div>
        <FunnelStrip
          steps={[
            { label: "Clicks", value: m.funnel.clicks, hint: "referral links" },
            { label: "Referred", value: m.funnel.referrals },
            { label: "Became hosts", value: m.funnel.hosts },
            { label: "Listed", value: m.funnel.listedHosts },
            { label: "Paying", value: m.funnel.payingHosts },
          ]}
        />
      </section>

      {/* ── Commission position ── */}
      <section>
        <div className="smallcaps mb-2">Commission ledger position</div>
        <StatBand>
          <StatTile
            label="In hold"
            value={formatMoneyExact(m.balance.pending, cur)}
            sub="pending clear"
          />
          <StatTile
            label="Available"
            value={formatMoneyExact(m.balance.available, cur)}
            sub="withdrawable now"
            tone="primary"
          />
          <StatTile
            label="In payout"
            value={formatMoneyExact(m.balance.inPayout, cur)}
            sub="claimed, in flight"
          />
          <StatTile
            label="Paid out"
            value={formatMoneyExact(m.balance.paid, cur)}
            sub={`${m.payouts.paidCount} payout${m.payouts.paidCount === 1 ? "" : "s"} · ${formatMoneyExact(m.payouts.feeTotal, cur)} fees`}
          />
        </StatBand>
        {m.balance.clawedBack > 0 ? (
          <p className="mt-2 text-[11.5px] text-brand-mute">
            {formatMoneyExact(m.balance.clawedBack, cur)} clawed back from
            refunds (already netted out of the figures above).
          </p>
        ) : null}
      </section>

      {/* ── Kind breakdown + open payouts ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="am-card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps">Commission by type</div>
          </div>
          <KindBreakdown rows={m.byKind} currency={cur} />
        </section>

        <section className="am-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps">Payouts owed</div>
            <Link
              href="/admin/affiliates/payouts"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
            >
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-px bg-brand-line">
            <PayoutCell
              label="Requested"
              value={formatMoneyExact(m.payouts.requested, cur)}
            />
            <PayoutCell
              label="Approved"
              value={formatMoneyExact(m.payouts.approved, cur)}
            />
            <PayoutCell
              label="Processing"
              value={formatMoneyExact(m.payouts.processing, cur)}
            />
          </div>
          <div className="px-5 py-3 text-[11.5px] text-brand-mute">
            {m.payouts.requested + m.payouts.approved + m.payouts.processing > 0
              ? "Net amounts owed to partners, not yet marked paid."
              : "No payouts are currently owed."}
          </div>
        </section>
      </div>

      {/* ── Per-campaign comparison ── */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">By campaign</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            How each campaign compares — plus everything on the default
            programme.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th className="r">Referrals</th>
                <th className="r">Live listings</th>
                <th className="r">Paying</th>
                <th className="r">Commission</th>
              </tr>
            </thead>
            <tbody>
              {m.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/admin/affiliates/campaigns/${c.id}`}
                      className="text-[13.5px] font-semibold text-brand-ink hover:text-brand-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`tag ${CAMPAIGN_STATUS[c.status] ?? "gray"}`}
                    >
                      <span className="d" />
                      <span className="capitalize">{c.status}</span>
                    </span>
                  </td>
                  <td className="num r text-brand-ink">{c.referrals}</td>
                  <td className="num r font-semibold text-brand-ink">
                    {c.liveListings}
                  </td>
                  <td className="num r text-brand-ink">{c.payingHosts}</td>
                  <td className="num r font-semibold text-brand-primary">
                    {formatMoneyExact(c.earned, cur)}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#FAFCFB]">
                <td className="text-[13.5px] font-semibold text-brand-ink">
                  Default programme
                </td>
                <td>
                  <span className="tag gray">
                    <span className="d" />
                    always on
                  </span>
                </td>
                <td className="num r text-brand-ink">
                  {m.defaultProgram.referrals}
                </td>
                <td className="num r text-brand-mute">—</td>
                <td className="num r text-brand-mute">—</td>
                <td className="num r font-semibold text-brand-primary">
                  {formatMoneyExact(m.defaultProgram.earned, cur)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PayoutCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <div className="smallcaps">{label}</div>
      <div className="num mt-1.5 font-display text-[15px] font-bold leading-tight text-brand-ink">
        {value}
      </div>
    </div>
  );
}
