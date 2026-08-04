// Plain (NON-client) data module for the campaign builder's field help.
//
// Why this is not in FieldHelp.tsx: that file is "use client", and the RSC
// bundler registers every export of a client module as a client *reference*.
// A server component (e.g. CampaignRulesBinder / the campaign page) that read
// CAMPAIGN_HELP.<key> off a client-module export hit
//   "Could not find the module …FieldHelp.tsx#CAMPAIGN_HELP#… in the React
//    Client Manifest"
// because the value is a proxy on the server, not a real object. Keeping the
// copy in a plain module lets both server and client components import it as
// ordinary data; only the <FieldHelp> component itself stays client.

export type HelpEntry = {
  title: string;
  body: string[];
  /** Optional worked example — rendered in a tinted box. */
  example?: string;
};

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
  maxParticipants: {
    title: "Places available",
    body: [
      "How many partners may take part. Once the places are gone, the Join button is closed and anyone else is told the competition is full.",
      "Leave it blank for unlimited. The limit counts only partners currently in the competition — if someone withdraws or you remove them, their place frees up for the next joiner.",
      "The cap is enforced by the database, not just this screen, so two partners joining at the same instant can never both take the last place.",
      "Raising the cap later re-opens joining. Lowering it below the number already in does NOT remove anyone — they keep their place; it just stops new joins.",
    ],
    example:
      "The Founding Programme runs UNCAPPED — leave this blank. Scarcity is the founding window (join before it closes), not a seat limit, so no partner is ever turned away.",
  },
  rulesDoc: {
    title: "Competition rules",
    body: [
      "The competition's rules, published at a fixed public URL (/legal/<slug>). South African consumer law expects promotional-competition rules to stay available at one address for the whole campaign.",
      "The rules text is authored in one place — Admin → Legal docs (the single source of truth for every legal document). Here you only choose WHICH document this competition points at.",
      "Once a document is bound, no partner can enter without ticking that they accept it — and each entry stores the exact version, date and IP.",
    ],
  },
  model: {
    title: "Commission model",
    body: [
      "Ladder: the rate rises as the partner's hosts generate more monthly subscription revenue. Crossing a rung lifts their whole book to the higher rate, not just the amount above it.",
      "Flat rate: the same rate (or a fixed rand amount) on every referred subscription.",
      "Inherit: no special campaign rate — partners earn the standard per-product commission they would get from their normal link.",
    ],
    example:
      "The Founding Race is Flat 60% for life — every host referred through a race link earns the partner 60% of that host's subscription, permanently.",
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
    example: "The Founding Race pays a flat 60%.",
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
      "Placing: a cash prize for a finishing position (1st, 2nd, 3rd…).",
      "Milestone: a cash prize for a named achievement — e.g. first host live, or the first partner to reach ten live listings.",
      "Monthly top mover: a recurring cash prize for the biggest net gain in a month (the anti-runaway-leader mechanism).",
      "Prizes are cash and are not paid automatically. When the campaign is judged you review and publish the winners on the Results tab, then settle each cash prize from there.",
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
