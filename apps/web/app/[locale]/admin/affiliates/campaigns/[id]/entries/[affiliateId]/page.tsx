import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { summariseCommissions } from "@/lib/affiliate/balance";
import { describeLadder, rateToPct } from "@/lib/affiliate/campaignConfig";
import type { CommissionStructure } from "@/lib/affiliate/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Competition-scoped record for ONE entrant — the drill-down from the campaign's
// Entries tab. The default-program record (/admin/affiliates/[id]) shows a
// partner's LIFETIME numbers; this shows only what they did in THIS competition:
// score, referrals bound under it, commission earned under it, prizes, floor,
// enrolment and rule acceptance. All read-only; a link out reaches the lifetime
// record. Everything is filtered by campaign_id — no cross-competition bleed.

const zar = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CampaignEntryPage({
  params,
}: {
  params: { id: string; affiliateId: string };
}) {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [{ data: campaign }, { data: account }] = await Promise.all([
    service
      .from("affiliate_campaigns")
      .select("id, slug, name, status, commission_structure, rules_doc_slug")
      .eq("id", params.id)
      .maybeSingle(),
    service
      .from("affiliate_accounts")
      .select("id, user_id, slug, status")
      .eq("id", params.affiliateId)
      .maybeSingle(),
  ]);
  if (!campaign || !account) notFound();

  const [
    { data: owner },
    { data: enrollment },
    { data: rawScores },
    { data: referrals },
    { data: commissions },
    { data: prizes },
    { data: floor },
    { data: ruleAcceptance },
  ] = await Promise.all([
    service
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", account.user_id)
      .maybeSingle(),
    service
      .from("affiliate_campaign_enrollments")
      .select("status, enrolled_at, paused_reason, paused_at")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", account.id)
      .maybeSingle(),
    service.rpc("campaign_active_listings", { p_campaign_id: campaign.id }),
    service
      .from("affiliate_referrals")
      .select("id, referred_user_id, bound_at")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", account.id)
      .order("bound_at", { ascending: false }),
    service
      .from("affiliate_commissions")
      .select("status, entry_type, payout_id, commission_amount, currency")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", account.id),
    service
      .from("affiliate_prize_awards")
      .select("label, amount, currency, status, awarded_at, paid_at")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", account.id)
      .order("awarded_at", { ascending: false }),
    service
      .from("affiliate_campaign_floors")
      .select("floor_rate, won_via, awarded_at")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", account.id)
      .maybeSingle(),
    service
      .from("affiliate_campaign_rule_acceptances")
      .select("doc_slug, doc_version, accepted_at, ip")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", account.id)
      .order("accepted_at", { ascending: false })
      .maybeSingle(),
  ]);

  const partnerName = owner?.full_name || owner?.email || "Unnamed partner";
  const enrolStatus = (enrollment?.status as string | null) ?? "active";

  const liveListings =
    (
      (rawScores ?? []) as {
        affiliate_id: string;
        active_listings: number;
      }[]
    ).find((s) => s.affiliate_id === account.id)?.active_listings ?? 0;

  const refRows = referrals ?? [];
  const referredUserIds = refRows.map((r) => r.referred_user_id as string);
  const { data: referredProfiles } = referredUserIds.length
    ? await service
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", referredUserIds)
    : {
        data: [] as {
          id: string;
          full_name: string | null;
          email: string | null;
        }[],
      };
  const profileById = new Map((referredProfiles ?? []).map((p) => [p.id, p]));

  const balance = summariseCommissions(
    (commissions ?? []) as {
      status: string;
      entry_type: string;
      payout_id: string | null;
      commission_amount: number;
      currency: string | null;
    }[],
  );

  const prizeRows = (prizes ?? []) as {
    label: string;
    amount: number;
    currency: string;
    status: string;
    awarded_at: string | null;
    paid_at: string | null;
  }[];
  const prizeTotal = prizeRows.reduce(
    (s, p) => (p.status === "void" ? s : s + Number(p.amount ?? 0)),
    0,
  );

  const ladderText = describeLadder(
    (campaign.commission_structure ?? null) as CommissionStructure | null,
  );
  const floorPct = floor ? rateToPct(Number(floor.floor_rate)) : null;

  const backHref = `/admin/affiliates/campaigns/${campaign.id}#partners`;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <nav className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-brand-mute">
          <Link href="/admin/affiliates" className="hover:underline">
            Affiliates
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/admin/affiliates/campaigns" className="hover:underline">
            Campaigns
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={backHref} className="hover:underline">
            {campaign.name}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-brand-ink">{partnerName}</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <Link
            href={backHref}
            aria-label="Back to entries"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-line bg-white text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-[20px] font-extrabold leading-none text-brand-ink">
            {partnerName}
          </h1>
          <span
            className={`tag ${enrolStatus === "paused" ? "amber" : "gray"}`}
          >
            <span className="d" />
            <span className="capitalize">{enrolStatus}</span>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-brand-mute">
          <span className="mono">/r/{account.slug}</span>
          <Link
            href={`/admin/affiliates/${account.id}`}
            className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline"
          >
            View full lifetime record
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <span>
            in{" "}
            <span className="font-medium text-brand-ink">{campaign.name}</span>
          </span>
        </div>
      </div>

      {/* STAT BAND */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-4">
        <Stat
          label="Live listings"
          value={String(liveListings)}
          sub="their score"
        />
        <Stat
          label="Referrals"
          value={String(refRows.length)}
          sub="bound to this race"
        />
        <Stat
          label="Commission earned"
          value={zar(balance.lifetime)}
          sub="net, this race"
        />
        <Stat
          label="Prizes"
          value={prizeRows.length ? zar(prizeTotal) : "—"}
          sub={prizeRows.length ? `${prizeRows.length} awarded` : "none yet"}
        />
      </section>

      {/* COMMISSION + RATE */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="am-card p-5">
          <div className="smallcaps">Commission — this competition</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Only rows stamped with this campaign. Pending clears after the
            refund hold; available is withdrawable in the partner&apos;s next
            payout.
          </p>
          <dl className="mt-4 divide-y divide-brand-line">
            <MoneyRow label="Pending (in hold)" value={zar(balance.pending)} />
            <MoneyRow label="Cleared" value={zar(balance.cleared)} />
            <MoneyRow label="Available now" value={zar(balance.available)} />
            <MoneyRow label="In a payout" value={zar(balance.inPayout)} />
            <MoneyRow label="Paid out" value={zar(balance.paid)} />
            {balance.clawedBack > 0 ? (
              <MoneyRow
                label="Clawed back"
                value={`−${zar(balance.clawedBack)}`}
                muted
              />
            ) : null}
            <MoneyRow
              label="Lifetime (net)"
              value={zar(balance.lifetime)}
              strong
            />
          </dl>
        </section>

        <section className="am-card p-5">
          <div className="smallcaps">Rate &amp; enrolment</div>
          <dl className="mt-4 divide-y divide-brand-line">
            <InfoRow label="Campaign rate" value={ladderText} />
            <InfoRow
              label="Rate floor won"
              value={
                floorPct != null
                  ? `${floorPct}% · ${floor?.won_via ?? "—"}`
                  : "None"
              }
            />
            <InfoRow
              label="Enrolment"
              value={
                enrollment
                  ? `${enrolStatus}${
                      enrollment.enrolled_at
                        ? ` · joined ${fmtDate(enrollment.enrolled_at as string)}`
                        : ""
                    }`
                  : "Racing (no explicit enrolment row)"
              }
            />
            <InfoRow
              label="Rules accepted"
              value={
                ruleAcceptance
                  ? `v${ruleAcceptance.doc_version} · ${fmtDateTime(
                      ruleAcceptance.accepted_at as string,
                    )}`
                  : campaign.rules_doc_slug
                    ? "Not signed"
                    : "No rules bound"
              }
            />
            {ruleAcceptance ? (
              <InfoRow
                label="Accepted from IP"
                value={(ruleAcceptance.ip as string | null) ?? "—"}
              />
            ) : null}
          </dl>
          {enrollment?.paused_reason ? (
            <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
              Paused: {enrollment.paused_reason}
            </p>
          ) : null}
        </section>
      </div>

      {/* PRIZES */}
      {prizeRows.length > 0 ? (
        <section className="am-card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps">Prizes</div>
          </div>
          <div className="overflow-x-auto">
            <table className="ttable">
              <thead>
                <tr>
                  <th>Prize</th>
                  <th className="r">Amount</th>
                  <th>Status</th>
                  <th>Awarded</th>
                </tr>
              </thead>
              <tbody>
                {prizeRows.map((p, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-brand-ink">{p.label}</td>
                    <td className="num r">{zar(Number(p.amount))}</td>
                    <td>
                      <span
                        className={`tag ${
                          p.status === "paid"
                            ? "green"
                            : p.status === "void"
                              ? "red"
                              : "amber"
                        }`}
                      >
                        <span className="d" />
                        <span className="capitalize">{p.status}</span>
                      </span>
                    </td>
                    <td className="num text-brand-mute">
                      {fmtDate((p.paid_at ?? p.awarded_at) as string | null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* REFERRALS */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Referred through this competition</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Hosts who signed up via this partner&apos;s competition link.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Host</th>
                <th>Bound</th>
              </tr>
            </thead>
            <tbody>
              {refRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-brand-mute">
                    No referrals bound to this competition yet.
                  </td>
                </tr>
              ) : (
                refRows.map((r) => {
                  const p = profileById.get(r.referred_user_id as string);
                  return (
                    <tr key={r.id as string}>
                      <td className="font-semibold text-brand-ink">
                        {p?.full_name || p?.email || "Unknown host"}
                      </td>
                      <td className="num text-brand-mute">
                        {fmtDate(r.bound_at as string | null)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="smallcaps">{label}</div>
      <div className="num mt-1.5 font-display text-[18px] font-bold leading-tight text-brand-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-brand-mute">{sub}</div>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-[12.5px] text-brand-mute">{label}</dt>
      <dd
        className={`num text-[13px] ${
          strong
            ? "font-bold text-brand-ink"
            : muted
              ? "text-brand-mute"
              : "font-medium text-brand-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-[12.5px] text-brand-mute">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-brand-ink">
        {value}
      </dd>
    </div>
  );
}
