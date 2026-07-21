import { ArrowUp, Award, Trophy } from "lucide-react";

import type {
  CampaignPrize,
  LeaderboardRow,
} from "@/lib/affiliate/leaderboard";

// Shared leaderboard furniture, built to the approved Founding Race design.
// The public page and the partner's Race tab render the SAME table and podium
// so a standing can never look different in two places.
//
// The design's hairline is #E4EFE8, a shade lighter than the app's brand-line
// token (#DCEAE0). It is written literally here rather than by retuning the
// global token, which would restyle every border in the product.
export const LINE = "#E4EFE8";

export function Medal({
  place,
  className = "",
}: {
  place: number;
  className?: string;
}) {
  const bg =
    place === 1
      ? "linear-gradient(150deg,#E4BE5A,#B4841E)"
      : place === 2
        ? "linear-gradient(150deg,#B9C4CE,#79899A)"
        : "linear-gradient(150deg,#CE9A6B,#9C623A)";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-pill font-display font-extrabold text-white ${className}`}
      style={{ background: bg }}
    >
      {place}
    </span>
  );
}

export function RankChip({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-[#FBF3DD] text-[#8A6410] border-[#EEDDAE]",
    2: "bg-[#F0F3F6] text-[#5C6B78] border-[#DCE3EA]",
    3: "bg-[#F7EBDF] text-[#8A5A2E] border-[#ECD5BF]",
  };
  return (
    <span
      className={`inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-[9px] border px-[7px] font-mono text-[13.5px] font-bold tabular-nums ${
        styles[rank] ?? "border-[#E4EFE8] bg-[#F4F7F5] text-brand-mute"
      }`}
    >
      {rank}
    </span>
  );
}

export function NetPill({ net }: { net: number }) {
  if (net > 0) {
    return (
      <span className="inline-flex items-center gap-[3px] rounded-pill bg-[#ECFDF5] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-[#047857]">
        <ArrowUp className="h-3 w-3" />
        {net}
      </span>
    );
  }
  if (net < 0) {
    return (
      <span className="inline-flex items-center gap-[3px] rounded-pill bg-[#FEF2F2] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-[#B91C1C]">
        {net}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[3px] rounded-pill bg-[#F4F7F5] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-[#8496A0]">
      ±0
    </span>
  );
}

/** Initials stand in when a partner has not uploaded a photo. */
function Avatar({
  name,
  photoUrl,
  size,
  className = "",
}: {
  name: string;
  photoUrl: string | null;
  size: number;
  className?: string;
}) {
  if (photoUrl) {
    // A partner-supplied absolute URL from any host — next/image would need
    // every domain allow-listed, so a plain img is the right call here.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        style={{ height: size, width: size }}
        className={`rounded-full bg-[#EEF4F0] object-cover ${className}`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      style={{ height: size, width: size, fontSize: Math.round(size * 0.36) }}
      className={`inline-flex items-center justify-center rounded-full bg-[#EEF4F0] font-display font-bold text-brand-secondary ${className}`}
    >
      {initials || "—"}
    </span>
  );
}

export function StandingsTable({
  rows,
  highlightAffiliateId,
  usePublicNames,
}: {
  rows: LeaderboardRow[];
  highlightAffiliateId?: string | null;
  /** Public page shows "Marié v." — the portal shows full names. */
  usePublicNames: boolean;
}) {
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full text-left" style={{ minWidth: 640 }}>
        <thead>
          <tr
            className="border-b text-brand-mute"
            style={{ borderColor: LINE }}
          >
            <th className="w-[64px] py-2.5 pl-5 pr-2 text-[11px] font-semibold uppercase tracking-wider">
              Rank
            </th>
            <th className="px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wider">
              Partner
            </th>
            <th className="hidden px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wider sm:table-cell">
              Region
            </th>
            <th className="hidden px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider md:table-cell">
              This month
            </th>
            <th className="py-2.5 pl-2 pr-5 text-right text-[11px] font-semibold uppercase tracking-wider">
              Hosts live
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => {
            const you = highlightAffiliateId === r.affiliateId;
            return (
              <tr
                key={r.affiliateId}
                className={`border-b transition-colors last:border-0 ${
                  you
                    ? "bg-brand-light hover:bg-[#EAFBF1]"
                    : "hover:bg-[#F7FBF8]"
                }`}
                style={{ borderColor: LINE }}
              >
                <td className="py-3 pl-5 pr-2">
                  <RankChip rank={r.rank} />
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={r.name}
                      photoUrl={r.photoUrl}
                      size={44}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-[14px] font-bold text-brand-ink">
                          {usePublicNames ? r.publicName : r.name}
                        </span>
                        {you ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-[#C7F0DC] bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-semibold text-[#047857]">
                            <span className="h-1.5 w-1.5 rounded-pill bg-brand-primary" />
                            You
                          </span>
                        ) : null}
                      </div>
                      {r.communityName || r.communityMembers ? (
                        <div className="truncate text-[12px] text-brand-mute">
                          {r.communityName}
                          {r.communityName && r.communityMembers ? " · " : ""}
                          {r.communityMembers
                            ? `${r.communityMembers.toLocaleString("en-ZA")} members`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="hidden px-2 py-3 sm:table-cell">
                  <span className="text-[13px] text-brand-ink">
                    {r.region ?? "—"}
                  </span>
                </td>
                <td className="hidden px-2 py-3 text-right md:table-cell">
                  <NetPill net={r.netThisMonth} />
                </td>
                <td className="py-3 pl-2 pr-5 text-right">
                  <div className="inline-flex items-baseline gap-1">
                    <span className="font-display text-[19px] font-extrabold text-brand-ink">
                      {r.listings}
                    </span>
                    <span className="text-[11px] text-brand-mute">pts</span>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center">
                <Trophy className="mx-auto h-6 w-6 text-brand-mute/50" />
                <p className="mt-2 text-[13px] text-brand-mute">
                  No partners are on the board yet — the first live listing puts
                  someone here.
                </p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const PLACE_TITLE: Record<number, string> = {
  1: "Founding Partner of the Year",
  2: "Runner-up",
  3: "Third place",
};

export function Podium({
  rows,
  prizes,
  usePublicNames,
}: {
  rows: LeaderboardRow[];
  prizes: CampaignPrize[];
  usePublicNames: boolean;
}) {
  const top3 = rows.slice(0, 3);
  if (top3.length === 0) return null;

  const prizeFor = (place: number) => {
    const p = prizes.find((x) => x.placing === place);
    if (!p) return null;
    const cash = p.cash ? `R${Number(p.cash).toLocaleString("en-ZA")}` : null;
    const floor = p.floor ? `${Math.round(p.floor * 100)}% floor` : null;
    return [cash, floor].filter(Boolean).join(" + ") || null;
  };

  // Staged 2 · 1 · 3 so the winner sits centre and raised.
  const order = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardRow[];
  const placeOf = (r: LeaderboardRow) => r.rank;

  return (
    <div className="mb-12 grid items-end gap-4 md:grid-cols-3">
      {order.map((r) => {
        const place = placeOf(r);
        const tall = place === 1;
        const cap =
          place === 1
            ? "linear-gradient(90deg,#E4BE5A,#B4841E)"
            : place === 2
              ? "linear-gradient(90deg,#B9C4CE,#79899A)"
              : "linear-gradient(90deg,#CE9A6B,#9C623A)";
        const prize = prizeFor(place);
        return (
          <div
            key={r.affiliateId}
            className={`overflow-hidden rounded-[18px] border bg-white shadow-card transition duration-150 hover:-translate-y-0.5 hover:shadow-lift ${
              tall ? "md:-translate-y-3" : ""
            }`}
            style={{ borderColor: LINE }}
          >
            <div className="h-1.5" style={{ background: cap }} />
            <div className={`p-5 text-center ${tall ? "sm:p-6" : ""}`}>
              <div className="relative inline-block">
                <Avatar
                  name={r.name}
                  photoUrl={r.photoUrl}
                  size={tall ? 80 : 64}
                  className="mx-auto shadow-lift ring-4 ring-white"
                />
                <Medal
                  place={place}
                  className="absolute -bottom-1 -right-1 h-[34px] w-[34px] text-[15px] ring-2 ring-white"
                />
              </div>
              <div
                className={`mt-3 font-display font-extrabold text-brand-ink ${tall ? "text-[18px]" : "text-[16px]"}`}
              >
                {usePublicNames ? r.publicName : r.name}
              </div>
              {r.communityName ? (
                <div className="mt-0.5 text-[12px] text-brand-mute">
                  {r.communityName}
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <span
                  className={`font-display font-extrabold leading-none text-brand-ink ${tall ? "text-[34px]" : "text-[28px]"}`}
                >
                  {r.listings}
                </span>
                <span className="text-[12px] text-brand-mute">hosts live</span>
              </div>
              {prize ? (
                <div
                  className="mt-3 inline-flex items-center gap-1.5 rounded-pill border bg-brand-light px-3 py-1.5 text-[11.5px] font-semibold text-brand-secondary"
                  style={{ borderColor: LINE }}
                >
                  <Award className="h-3.5 w-3.5" />
                  {prize}
                </div>
              ) : null}
              <div className="mt-2 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute/80">
                {PLACE_TITLE[place]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
