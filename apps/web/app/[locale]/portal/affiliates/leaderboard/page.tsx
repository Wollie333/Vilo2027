import type { Metadata } from "next";
import { Trophy } from "lucide-react";

import { getAffiliateForUser } from "@/lib/affiliate/account";
import { summariseCommissions } from "@/lib/affiliate/balance";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Affiliate leaderboard" };
export const dynamic = "force-dynamic";

const TOP_N = 20;

// Privacy-friendly display name: first name + last initial, else the slug.
function anonName(full: string | null, slug: string): string {
  const name = (full ?? "").trim();
  if (!name) return slug;
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export default async function AffiliateLeaderboardPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const me = await getAffiliateForUser(admin, user.id);
  if (!me) return null; // layout shows the terms gate

  const [{ data: accounts }, { data: commissions }] = await Promise.all([
    admin
      .from("affiliate_accounts")
      .select("id, user_id, slug, currency, status")
      .eq("status", "active"),
    admin
      .from("affiliate_commissions")
      .select(
        "affiliate_id, status, entry_type, payout_id, commission_amount, currency",
      ),
  ]);

  const accts = accounts ?? [];
  const { data: profiles } = accts.length
    ? await admin
        .from("user_profiles")
        .select("id, full_name")
        .in(
          "id",
          accts.map((a) => a.user_id),
        )
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const commByAffiliate = new Map<string, typeof commissions>();
  for (const c of commissions ?? []) {
    const arr = commByAffiliate.get(c.affiliate_id) ?? [];
    arr.push(c);
    commByAffiliate.set(c.affiliate_id, arr);
  }

  const ranked = accts
    .map((a) => {
      const bal = summariseCommissions(
        (commByAffiliate.get(a.id) ?? []).map((c) => ({
          status: c.status,
          entry_type: c.entry_type,
          payout_id: c.payout_id,
          commission_amount: Number(c.commission_amount),
          currency: c.currency,
        })),
        a.currency,
      );
      return {
        id: a.id,
        isMe: a.id === me.id,
        name: anonName(nameByUser.get(a.user_id) ?? null, a.slug),
        lifetime: bal.lifetime,
        currency: a.currency,
      };
    })
    .filter((r) => r.lifetime > 0 || r.isMe)
    .sort((a, b) => b.lifetime - a.lifetime)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const top = ranked.slice(0, TOP_N);
  const mine = ranked.find((r) => r.isMe);
  const showMineSeparately = mine && mine.rank > TOP_N;

  const medal = (rank: number) =>
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        <Trophy className="h-3.5 w-3.5 text-brand-primary" />
        Top affiliates by lifetime earnings
      </div>
      <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-brand-mute">
        See how you stack up. Keep sharing your link — every referral moves you
        up.
      </p>

      <div className="mt-5 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light/50 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <th className="w-16 px-4 py-3">Rank</th>
              <th className="px-4 py-3">Affiliate</th>
              <th className="px-4 py-3 text-right">Lifetime earned</th>
            </tr>
          </thead>
          <tbody>
            {top.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-brand-mute"
                >
                  No earnings on the board yet — be the first!
                </td>
              </tr>
            ) : (
              top.map((r) => <Row key={r.id} r={r} medal={medal(r.rank)} />)
            )}
            {showMineSeparately && mine ? (
              <>
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-1 text-center text-[11px] text-brand-mute"
                  >
                    · · ·
                  </td>
                </tr>
                <Row r={mine} medal={medal(mine.rank)} />
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  r,
  medal,
}: {
  r: {
    rank: number;
    name: string;
    lifetime: number;
    currency: string;
    isMe: boolean;
  };
  medal: string | null;
}) {
  return (
    <tr
      className={`border-b border-brand-line last:border-0 ${
        r.isMe ? "bg-brand-light/60" : ""
      }`}
    >
      <td className="px-4 py-3">
        <span className="num font-semibold text-brand-ink">
          {medal ?? `#${r.rank}`}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-brand-ink">{r.name}</span>
        {r.isMe ? (
          <span className="ml-2 inline-flex items-center rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-semibold text-white">
            You
          </span>
        ) : null}
      </td>
      <td className="num px-4 py-3 text-right font-semibold text-brand-ink">
        {formatMoney(r.lifetime, r.currency)}
      </td>
    </tr>
  );
}
