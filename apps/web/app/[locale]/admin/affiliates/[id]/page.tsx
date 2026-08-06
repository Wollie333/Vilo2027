import {
  ArrowLeft,
  BadgeCheck,
  Coins,
  ExternalLink,
  Link2,
  MousePointerClick,
  Package,
  UserPlus,
  Wallet,
} from "lucide-react";
import { notFound } from "next/navigation";

import { PartnerCodeCard } from "@/components/affiliate/PartnerCodeCard";
import { VerifiedBadge } from "@/components/affiliate/VerifiedBadge";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { listAcceptances } from "@/lib/affiliate/agreement";

import { VerifyPartnerButton } from "../_components/VerifyPartnerButton";
import { ReassignReferralControl } from "./ReassignReferralControl";
import { summariseCommissions } from "@/lib/affiliate/balance";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPayingSubscription } from "@/lib/affiliate/paying";

export const dynamic = "force-dynamic";

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function payoutTag(status: string): { cls: string; label: string } {
  switch (status) {
    case "paid":
      return { cls: "green", label: "Paid" };
    case "approved":
      return { cls: "sky", label: "Approved" };
    case "processing":
      return { cls: "indigo", label: "Processing" };
    case "rejected":
    case "failed":
      return { cls: "red", label: status === "failed" ? "Failed" : "Rejected" };
    case "cancelled":
      return { cls: "gray", label: "Cancelled" };
    default:
      return { cls: "amber", label: "Requested" };
  }
}

// Admin per-affiliate funnel: clicks → signups → paid customers → commission,
// with the referred users and payout history. The affiliate tables stay the
// source of truth; this is a read-only drill-down from the affiliate list.
export default async function AdminAffiliateFunnelPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: account } = await service
    .from("affiliate_accounts")
    .select(
      "id, user_id, slug, partner_number, status, currency, created_at, verified_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!account) notFound();

  const [
    { data: owner },
    { data: clickRows },
    { data: referrals },
    { data: commissions },
    { data: payouts },
    acceptances,
  ] = await Promise.all([
    service
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", account.user_id)
      .maybeSingle(),
    service
      .from("affiliate_clicks")
      .select("landing_path, campaign_id")
      .eq("affiliate_id", account.id),
    service
      .from("affiliate_referrals")
      .select("id, referred_user_id, bound_at")
      .eq("affiliate_id", account.id)
      .order("bound_at", { ascending: false }),
    service
      .from("affiliate_commissions")
      .select(
        "referral_id, status, entry_type, payout_id, commission_amount, currency",
      )
      .eq("affiliate_id", account.id),
    service
      .from("affiliate_payouts")
      .select(
        "id, method, status, gross_amount, fee_amount, net_amount, currency, requested_at, processed_at",
      )
      .eq("affiliate_id", account.id)
      .order("requested_at", { ascending: false }),
    listAcceptances(service, account.id),
  ]);

  const refs = referrals ?? [];
  const userIds = refs.map((r) => r.referred_user_id);
  const [{ data: profiles }, { data: hosts }] = await Promise.all([
    userIds.length
      ? service
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", userIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            full_name: string | null;
            email: string | null;
          }[],
        }),
    userIds.length
      ? service.from("hosts").select("id, user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const hostByUser = new Map((hosts ?? []).map((h) => [h.user_id, h.id]));
  const hostIds = (hosts ?? []).map((h) => h.id);
  const { data: subs } = hostIds.length
    ? await service
        .from("subscriptions")
        .select("host_id, plan, status")
        .in("host_id", hostIds)
    : {
        data: [] as { host_id: string; plan: string | null; status: string }[],
      };
  const planByHost = new Map(
    (subs ?? []).map((s) => [s.host_id, { plan: s.plan, status: s.status }]),
  );

  const commByReferral = new Map<string, number>();
  for (const c of commissions ?? []) {
    if (c.status === "voided") continue;
    commByReferral.set(
      c.referral_id,
      (commByReferral.get(c.referral_id) ?? 0) + Number(c.commission_amount),
    );
  }

  const rows = refs.map((r) => {
    const profile = profileById.get(r.referred_user_id);
    const hostId = hostByUser.get(r.referred_user_id);
    const sub = hostId ? planByHost.get(hostId) : undefined;
    const isPaid = !!sub && isPayingSubscription(sub);
    return {
      id: r.id,
      name: profile?.full_name || "Unnamed",
      email: profile?.email ?? null,
      paid: isPaid,
      plan: isPaid ? (sub!.plan as string) : hostId ? "free" : "guest",
      joined: r.bound_at,
      commission: commByReferral.get(r.id) ?? 0,
      // 30-day admin correction window (SoT §3.2 rule 5).
      withinWindow:
        r.bound_at != null &&
        Date.now() - Date.parse(r.bound_at) < 30 * 24 * 60 * 60 * 1000,
    };
  });

  const bal = summariseCommissions(
    (commissions ?? []).map((c) => ({
      status: c.status,
      entry_type: c.entry_type,
      payout_id: c.payout_id,
      commission_amount: Number(c.commission_amount),
      currency: c.currency,
    })),
    account.currency,
  );

  // Clicks by link (which links worked): group the affiliate's clicks by the
  // destination they landed on, flagging competition-link clicks.
  const campaignIds = Array.from(
    new Set((clickRows ?? []).map((c) => c.campaign_id).filter(Boolean)),
  ) as string[];
  const { data: campaignRows } = campaignIds.length
    ? await service
        .from("affiliate_campaigns")
        .select("id, name")
        .in("id", campaignIds)
    : { data: [] as { id: string; name: string }[] };
  const campaignName = new Map((campaignRows ?? []).map((c) => [c.id, c.name]));
  const clicksByLink = new Map<
    string,
    { count: number; campaign: string | null }
  >();
  for (const c of clickRows ?? []) {
    const key = c.campaign_id
      ? `${campaignName.get(c.campaign_id) ?? "Competition"} · ${c.landing_path ?? "/"}`
      : (c.landing_path ?? "/");
    const cur = clicksByLink.get(key) ?? {
      count: 0,
      campaign: c.campaign_id
        ? (campaignName.get(c.campaign_id) ?? "Competition")
        : null,
    };
    cur.count += 1;
    clicksByLink.set(key, cur);
  }
  const linkRows = Array.from(clicksByLink.entries())
    .map(([link, v]) => ({ link, ...v }))
    .sort((a, b) => b.count - a.count);

  // Products referred: distinct Wielo products the referred hosts have actually
  // paid for (completed charges), with how many referred hosts bought each.
  const { data: charges } = hostIds.length
    ? await service
        .from("platform_ledger")
        .select("host_id, product_id")
        .in("host_id", hostIds)
        .eq("type", "charge")
        .eq("status", "completed")
        .not("product_id", "is", null)
    : { data: [] as { host_id: string; product_id: string | null }[] };
  const productIds = Array.from(
    new Set((charges ?? []).map((c) => c.product_id).filter(Boolean)),
  ) as string[];
  const { data: productRows } = productIds.length
    ? await service.from("products").select("id, name").in("id", productIds)
    : { data: [] as { id: string; name: string }[] };
  const productName = new Map((productRows ?? []).map((p) => [p.id, p.name]));
  const productHosts = new Map<string, Set<string>>();
  for (const c of charges ?? []) {
    if (!c.product_id) continue;
    const set = productHosts.get(c.product_id) ?? new Set<string>();
    set.add(c.host_id);
    productHosts.set(c.product_id, set);
  }
  const productsReferred = Array.from(productHosts.entries())
    .map(([pid, hostsSet]) => ({
      name: productName.get(pid) ?? "Product",
      hosts: hostsSet.size,
    }))
    .sort((a, b) => b.hosts - a.hosts);

  const clicks = (clickRows ?? []).length;
  const signups = rows.length;
  const paidCount = rows.filter((r) => r.paid).length;
  const isActive = account.status === "active";
  const isVerified = Boolean(account.verified_at);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <Link
          href="/admin/affiliates"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to affiliates
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-ink">
              {owner?.full_name || "Affiliate"}
              {isVerified ? <VerifiedBadge className="h-5 w-5" /> : null}
            </h1>
            <p className="mono mt-0.5 text-[12px] text-brand-mute">
              /r/{account.slug}
              {owner?.email ? ` · ${owner.email}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PartnerCodeCard
              partnerNumber={account.partner_number}
              slug={account.slug}
            />
            <Link
              href={`/admin/users/${account.user_id}`}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View user account
            </Link>
            <VerifyPartnerButton
              affiliateId={account.id}
              verified={isVerified}
            />
            <span className={`tag ${isActive ? "green" : "red"}`}>
              <span className="d" />
              {isActive ? "Active partner" : "Suspended"}
            </span>
          </div>
        </div>
      </div>

      {/* FUNNEL STAT BAND */}
      <div className="fade grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line md:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          label="Link clicks"
          value={String(clicks)}
        />
        <Stat
          icon={<UserPlus className="h-3.5 w-3.5" />}
          label="Signups"
          value={String(signups)}
          hint={clicks ? `${pct(signups, clicks)}% of clicks` : undefined}
        />
        <Stat
          icon={<BadgeCheck className="h-3.5 w-3.5" />}
          label="Paid customers"
          value={String(paidCount)}
          hint={`${signups - paidCount} on free`}
        />
        <Stat
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Lifetime earned"
          value={formatMoney(bal.lifetime, account.currency)}
        />
        <div className="col-span-2 bg-brand-secondary p-4 md:col-span-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            <Wallet className="h-3.5 w-3.5" /> Available
          </div>
          <div className="num mt-2 font-display text-[26px] font-bold leading-none text-white">
            {formatMoney(bal.available, account.currency)}
          </div>
          <div className="mt-1.5 text-[11px] text-brand-accent">
            {formatMoney(bal.pending, account.currency)} pending
          </div>
        </div>
      </div>

      {/* FUNNEL BARS */}
      <div className="am-card p-5">
        <div className="smallcaps">Funnel</div>
        <div className="mt-4 space-y-3">
          <FunnelBar label="Clicks" value={clicks} width={100} />
          <FunnelBar
            label="Signups"
            value={signups}
            width={pct(signups, clicks)}
          />
          <FunnelBar
            label="Paid customers"
            value={paidCount}
            width={pct(paidCount, clicks)}
          />
        </div>
      </div>

      {/* WHICH LINKS WORKED + PRODUCTS REFERRED */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="am-card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Clicks by link
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="ttable">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th className="r">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {linkRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-8 text-center text-brand-mute"
                    >
                      No clicks recorded yet.
                    </td>
                  </tr>
                ) : (
                  linkRows.map((l) => (
                    <tr key={l.link}>
                      <td>
                        <span className="mono text-[12px] text-brand-ink">
                          {l.link}
                        </span>
                        {l.campaign ? (
                          <span className="chip ml-2 bg-brand-accent text-brand-secondary">
                            competition
                          </span>
                        ) : null}
                      </td>
                      <td className="num r font-semibold text-brand-ink">
                        {l.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="am-card overflow-hidden">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Products referred
            </div>
            <p className="mt-0.5 text-[11.5px] text-brand-mute">
              What the referred hosts have actually paid for.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="ttable">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Referred buyers</th>
                </tr>
              </thead>
              <tbody>
                {productsReferred.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-8 text-center text-brand-mute"
                    >
                      No paid products yet.
                    </td>
                  </tr>
                ) : (
                  productsReferred.map((p) => (
                    <tr key={p.name}>
                      <td className="text-[13px] font-medium text-brand-ink">
                        {p.name}
                      </td>
                      <td className="num r font-semibold text-brand-ink">
                        {p.hosts}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* REFERRED USERS */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Referred users</div>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Referred user</th>
                <th>Plan</th>
                <th>Joined</th>
                <th className="r">Commission</th>
                <th className="r">Attribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-brand-mute">
                    No referrals yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                          {r.name}
                        </div>
                        {r.email ? (
                          <div className="truncate text-[11px] text-brand-mute">
                            {r.email}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`chip capitalize ${
                          r.paid
                            ? "bg-brand-accent text-brand-secondary"
                            : "bg-brand-light text-brand-mute"
                        }`}
                      >
                        {r.plan}
                      </span>
                    </td>
                    <td className="num text-brand-mute">{fmtDate(r.joined)}</td>
                    <td className="num r font-semibold text-brand-ink">
                      {formatMoney(r.commission, account.currency)}
                    </td>
                    <td className="r align-top">
                      <ReassignReferralControl
                        referralId={r.id}
                        referredName={r.name}
                        withinWindow={r.withinWindow}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SIGNED AGREEMENT */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Signed agreement</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Each acceptance stores a full snapshot of the agreement text signed.
            Records are immutable and retained for three years.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Version</th>
                <th>Signed</th>
                <th>IP</th>
                <th>Document hash</th>
              </tr>
            </thead>
            <tbody>
              {acceptances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-brand-mute">
                    No signature on file — this partner signs on their next
                    portal visit.
                  </td>
                </tr>
              ) : (
                acceptances.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold text-brand-ink">
                      {a.version}
                    </td>
                    <td className="num text-brand-mute">
                      {new Date(a.accepted_at).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="mono text-[11.5px] text-brand-mute">
                      {a.ip ?? "—"}
                    </td>
                    <td
                      className="mono text-[11px] text-brand-mute"
                      title={a.body_sha256}
                    >
                      {a.body_sha256.slice(0, 16)}…
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PAYOUTS */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Payouts</div>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Method</th>
                <th className="r">Net</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-brand-mute">
                    No payouts yet.
                  </td>
                </tr>
              ) : (
                (payouts ?? []).map((p) => {
                  const tag = payoutTag(p.status);
                  return (
                    <tr key={p.id}>
                      <td className="num text-brand-mute">
                        {fmtDate(p.requested_at)}
                      </td>
                      <td className="uppercase text-brand-mute">{p.method}</td>
                      <td className="num r font-semibold text-brand-ink">
                        {formatMoney(Number(p.net_amount), p.currency)}
                      </td>
                      <td>
                        <span className={`tag ${tag.cls}`}>
                          <span className="d" />
                          {tag.label}
                        </span>
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
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="smallcaps flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="num mt-2 font-display text-[26px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-[11px] text-brand-mute">{hint}</div>
      ) : null}
    </div>
  );
}

function FunnelBar({
  label,
  value,
  width,
}: {
  label: string;
  value: number;
  width: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-medium text-brand-ink">{label}</span>
        <span className="num text-brand-mute">{value}</span>
      </div>
      <div className="pbar mt-1.5">
        <div style={{ width: `${Math.max(width, value > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}
