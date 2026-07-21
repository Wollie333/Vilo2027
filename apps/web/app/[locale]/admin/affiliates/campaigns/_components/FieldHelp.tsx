"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// A superscript ⓘ next to a field label. Clicking it explains, in plain
// language, what the field does and what it changes for partners — campaign
// config is money config, so nothing here should have to be guessed at.

export type HelpEntry = {
  title: string;
  body: string[];
  /** Optional worked example — rendered in a tinted box. */
  example?: string;
};

export function FieldHelp({ help }: { help: HelpEntry }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is "${help.title}"?`}
          className="ml-1 inline-flex -translate-y-1 items-center justify-center rounded-full align-super text-brand-mute transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="font-display text-[13.5px] font-bold text-brand-ink">
          {help.title}
        </div>
        <div className="mt-1.5 space-y-2 text-[12.5px] leading-relaxed text-brand-mute">
          {help.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {help.example ? (
          <p className="mt-2.5 rounded-[8px] bg-brand-light/70 p-2.5 text-[12px] leading-relaxed text-brand-ink">
            {help.example}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Every explanation in one place, so the copy can be reviewed as a set. */
export const CAMPAIGN_HELP = {
  name: {
    title: "Campaign name",
    body: [
      "What partners and the public see at the top of the leaderboard, and how the campaign is listed in their portal.",
      "You can change it at any time — it is display text only and does not affect scoring or commission.",
    ],
    example: 'For example: "Founding Race".',
  },
  slug: {
    title: "Public link",
    body: [
      "The web address of this competition's public leaderboard. Anyone with the link can view standings — no sign-in needed.",
      "Changing it after you have shared the link will break the old one, so set it before you publish anything.",
    ],
    example: "wielo.co.za/competitions/founding-race",
  },
  starts: {
    title: "Start date",
    body: [
      "When the competition period opens. Used together with “which referrals count” to decide whose hosts count towards the score.",
      "Leaving it blank means there is no start boundary — every qualifying referral counts, whenever it happened.",
    ],
  },
  ends: {
    title: "End date",
    body: [
      "When the competition closes. After this date the public page shows final standings instead of a live leaderboard.",
      "The campaign does not stop paying commission on its own — end it explicitly with the End campaign button when you are ready.",
    ],
  },
  eligiblePartners: {
    title: "Who can join",
    body: [
      "Every partner: anyone with an affiliate account can enter from their portal.",
      "Tagged partners only: still self-serve, but limited to partners you have tagged for this campaign.",
      "Invite only: nobody can self-enter — you add partners yourself.",
    ],
  },
  eligibleReferrals: {
    title: "Which referrals count",
    body: [
      "Decides which of a partner's hosts count towards their score.",
      "All of their referrals, ever: the partner's whole history counts, including hosts they brought in long before this campaign.",
      "Referred during the campaign: only hosts who clicked their link between the start and end dates.",
      "Went live during the campaign: only hosts whose listing actually went live in the window — the strictest and the fairest for a race.",
    ],
  },
  rulesDoc: {
    title: "Rules document",
    body: [
      "The competition rules, published at a fixed public URL. South African consumer law expects promotional competition rules to stay available at one address for the duration.",
      "Once a rules document is linked, no partner can enter without ticking that they accept it — and each entry stores the exact text, version, date and IP.",
      "Write the rules in the editor lower down this page; it publishes them and links them here automatically.",
    ],
  },
  model: {
    title: "Commission model",
    body: [
      "Ladder: the rate rises as the partner's hosts generate more monthly subscription revenue. Crossing a rung lifts their whole book to the higher rate, not just the amount above it.",
      "Flat rate: the same rate (or a fixed rand amount) on every referred subscription.",
      "Inherit: no special campaign rate — partners earn the standard per-product commission they would get from their normal link.",
    ],
  },
  duration: {
    title: "Paid for how long",
    body: [
      "One payment only: the partner earns on the host's first payment and nothing after.",
      "A set number of payments: earns for that many billing cycles, then stops.",
      "For as long as the host pays: recurring for the life of the subscription. This is what a lifetime referral programme means — it is a long commitment, so be deliberate.",
    ],
  },
  scope: {
    title: "Applies to",
    body: [
      "Which kind of purchase this structure covers. “subscription” means the host's recurring membership.",
      "Leave it as it is unless you are deliberately running a campaign on a different product type.",
    ],
  },
  recurringPeriods: {
    title: "Number of payments",
    body: [
      "How many billing cycles the partner keeps earning on each referred host before commission stops.",
    ],
    example: "12 on a monthly plan means they earn for that host's first year.",
  },
  bands: {
    title: "Ladder rungs",
    body: [
      "Each rung is a ceiling and the rate paid at or below it. The ceiling is the partner's monthly subscription book — the combined monthly revenue of the hosts they brought in.",
      "It is a whole-book ladder: passing a ceiling lifts the rate on everything they have, not only the portion above it.",
      "Exactly one rung must be left with no ceiling. That is the top rate, paid above every other rung.",
    ],
    example:
      "Up to R10 000 → 10%, up to R25 000 → 15%, no ceiling → 25%. A partner with a R26 000 book earns 25% on the whole R26 000.",
  },
  flatRate: {
    title: "Flat rate",
    body: [
      "The single rate every referred subscription pays. As a percent it is a share of what the host pays; as a rand amount it is a fixed sum per subscription.",
    ],
  },
  conversionBonus: {
    title: "Conversion bonus",
    body: [
      "A one-off rand payment when a referred host converts to a paid plan, on top of the ongoing commission.",
      "Set a separate amount for hosts who choose monthly and annual billing — an annual signup is usually worth more, so it usually earns more.",
      "Leave both at 0 to run the campaign on commission alone.",
    ],
  },
  scoring: {
    title: "Scoring",
    body: [
      "Total live listings: partners are ranked by how many of their hosts' listings are live right now. If a host leaves, the score drops — it rewards durable referrals.",
      "Net change over the period: ranks by growth during the campaign window rather than the standing total, which gives newer partners a fair chance against big existing books.",
    ],
  },
  leaderboard: {
    title: "Leaderboard visibility",
    body: [
      "Public: anyone with the link sees standings. Only a partner's first name and last initial (or their chosen display name) is shown — never their email.",
      "Partners only: standings appear in the affiliate portal but the public page returns nothing.",
      "Hidden: no leaderboard at all. Useful while you are still setting the campaign up.",
    ],
  },
  pointsPerListing: {
    title: "Points per live listing",
    body: [
      "How much each live listing adds to a partner's score. Leave it at 1 to rank purely by number of listings.",
      "Raise it only if you later score several different events and need to weigh them against each other.",
    ],
  },
  countActiveOnly: {
    title: "Only count hosts who are still live",
    body: [
      "On: a host who cancels or goes dark stops counting, so the leaderboard reflects reality today.",
      "Off: once a host has counted, they count forever — which rewards volume over quality and can be gamed.",
    ],
  },
  eachListingCounts: {
    title: "Every listing counts",
    body: [
      "On: a host with four live places contributes four. This rewards partners who bring in multi-property hosts.",
      "Off: each host counts once no matter how many places they run.",
    ],
  },
  tieBreaker: {
    title: "Tie breaker",
    body: [
      "How equal scores are settled. Pick from the list — it is stored as a fixed value so the same wording appears everywhere and cannot be mistyped.",
      "This is a statement of the rule, not an automatic process: Wielo does not split ties for you. Whatever you choose here should also be written into the rules document, because it decides who takes a prize.",
    ],
  },
  prizes: {
    title: "Prizes",
    body: [
      "Place: the finishing position this prize is for. Leave it blank for a milestone prize that is not tied to a position.",
      "Cash: the rand amount paid to the winner.",
      "Rate floor: permanently locks that partner's minimum commission rate. It outlives the campaign — treat it as a lasting commitment, not a once-off.",
      "Monthly top mover: a recurring prize for the biggest gain in a month.",
      "Milestone: a named achievement chosen from the list, for example the first partner to reach ten live listings.",
      "Prizes are not paid automatically. When the campaign is judged you pay them from Affiliates → Payouts, where you can filter to this campaign.",
    ],
  },
  rulesEditor: {
    title: "Writing the rules",
    body: [
      "Publishing puts these rules live at the URL beside them and points the campaign at it. Partners must accept them to enter.",
      "The version number only increases when the text actually changes, and each partner's entry is signed against the version they saw.",
      "Editing later publishes a new version. Partners who already entered keep the signature for the version they accepted — their record still shows the exact text they agreed to.",
    ],
  },
  status: {
    title: "Campaign status",
    body: [
      "Draft: nothing is paid at campaign rates and the public leaderboard is not reachable. Safe to configure in.",
      "Live: enrolled partners earn this campaign's rates and the leaderboard is public.",
      "Pausing returns it to draft. Ending it closes entries and shows final standings.",
    ],
  },
} as const satisfies Record<string, HelpEntry>;
