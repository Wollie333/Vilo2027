"use client";

import { Check, Copy, Flag, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { enrollInCampaignAction } from "../actions";

// One campaign panel on the Competitions tab (WS-1.4). Shows the partner's
// campaign link (copy), their live score + rank, the commission structure in
// plain language, and a CPA-safe "potential earnings" calculator. All figures
// are display/projection only — no money is written here.
export function CampaignCard({
  campaignId,
  name,
  structureSummary,
  ladderText,
  campaignLink,
  enrolled,
  score,
  rank,
  calculator,
  rulesHref,
  rulesVersion,
}: {
  campaignId: string;
  name: string;
  structureSummary: string;
  ladderText: string[];
  campaignLink: string;
  enrolled: boolean;
  score: number;
  rank: number | null;
  calculator: {
    listings: number;
    perHost: string;
    potentialBook: string;
    potentialRatePct: number;
    potentialMonthly: string;
    toNext: { amount: string; nextRatePct: number } | null;
  };
  rulesHref: string | null;
  /** Published rules version, when this campaign has rules. Accepting them is a
   *  condition of entry — the server refuses to enrol without it. */
  rulesVersion?: number | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [acceptedRules, setAcceptedRules] = useState(false);
  const display = campaignLink.replace(/^https?:\/\//, "");
  const rulesRequired = Boolean(rulesHref && rulesVersion);

  async function copy() {
    try {
      await navigator.clipboard.writeText(campaignLink);
      setCopied(true);
      toast.success("Campaign link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  function join() {
    if (rulesRequired && !acceptedRules) return;
    startTransition(async () => {
      const res = await enrollInCampaignAction(campaignId, acceptedRules);
      if (res.ok) {
        toast.success(`You've joined the ${name}.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-line p-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            <Trophy className="h-3.5 w-3.5 text-brand-primary" />
            Competition
          </div>
          <h3 className="mt-1 text-[18px] font-bold text-brand-ink">{name}</h3>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-brand-mute">
            {structureSummary}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            My rank
          </div>
          <div className="num text-2xl font-extrabold text-brand-ink">
            {rank
              ? rank === 1
                ? "🥇"
                : rank === 2
                  ? "🥈"
                  : rank === 3
                    ? "🥉"
                    : `#${rank}`
              : "—"}
          </div>
          <div className="text-[12px] text-brand-mute">
            {score} live {score === 1 ? "listing" : "listings"}
          </div>
        </div>
      </div>

      {/* Campaign link */}
      <div className="p-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          <Flag className="h-3.5 w-3.5 text-brand-primary" />
          Your campaign link
        </div>
        {enrolled ? (
          <div className="mt-2 flex h-12 items-center gap-2.5 rounded-[11px] border border-brand-accent bg-brand-light pl-4 pr-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-brand-ink">
              {display}
            </span>
            <button
              onClick={copy}
              className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-[13px] text-brand-mute">
              Join the competition to get your campaign link and appear on the
              leaderboard.
            </p>
            {rulesRequired ? (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-[11px] border border-brand-line bg-brand-light/40 p-3">
                <input
                  type="checkbox"
                  checked={acceptedRules}
                  onChange={(e) => setAcceptedRules(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-[13px] leading-relaxed text-brand-ink">
                  I have read and accept the{" "}
                  <a
                    href={rulesHref!}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-primary underline underline-offset-2"
                  >
                    {name} rules
                  </a>{" "}
                  (version {rulesVersion}). Your acceptance is recorded with the
                  date and your IP address.
                </span>
              </label>
            ) : null}
            <button
              onClick={join}
              disabled={pending || (rulesRequired && !acceptedRules)}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
            >
              {pending ? "Joining…" : "Join competition"}
            </button>
          </div>
        )}

        {/* Ladder */}
        {ladderText.length ? (
          <div className="mt-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Commission ladder
            </div>
            <ul className="mt-2 grid gap-1 text-[13px] text-brand-ink sm:grid-cols-2">
              {ladderText.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-brand-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Calculator */}
        <div className="mt-5 rounded-[12px] border border-brand-line bg-brand-light/40 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Your potential — if every live host subscribes
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-brand-ink">
            Your {calculator.listings} live{" "}
            {calculator.listings === 1 ? "listing" : "listings"} at{" "}
            {calculator.perHost}/mo each is a potential book of{" "}
            <span className="font-semibold">{calculator.potentialBook}/mo</span>
            . At {calculator.potentialRatePct}% that&apos;s about{" "}
            <span className="num font-bold text-brand-secondary">
              {calculator.potentialMonthly}/mo
            </span>{" "}
            in recurring commission.
          </p>
          {calculator.toNext ? (
            <p className="mt-1.5 text-[12px] text-brand-mute">
              {calculator.toNext.amount}/mo more book lifts your whole book to{" "}
              {calculator.toNext.nextRatePct}%.
            </p>
          ) : null}
          <p className="mt-2 text-[11px] italic text-brand-mute">
            An illustration, not a guarantee — actual commission depends on
            which of your hosts subscribe and stay active.
          </p>
        </div>

        {rulesHref ? (
          <a
            href={rulesHref}
            className="mt-4 inline-block text-[13px] font-medium text-brand-primary underline underline-offset-2"
          >
            Competition rules
          </a>
        ) : null}
      </div>
    </div>
  );
}
