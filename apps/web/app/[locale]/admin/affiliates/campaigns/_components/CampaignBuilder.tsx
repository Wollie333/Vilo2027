"use client";

import {
  AlertTriangle,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Flag,
  Gift,
  Pause,
  Play,
  Plus,
  Rocket,
  Save,
  SlidersHorizontal,
  Trash2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  COMMISSION_DURATIONS,
  COMMISSION_MODELS,
  COMMISSION_SCOPES,
  ELIGIBLE_PARTNERS,
  ELIGIBLE_REFERRALS,
  LEADERBOARD_VISIBILITY,
  MILESTONES,
  SCORING_MODES,
  TIE_BREAKERS,
  pctToRate,
  rateToPct,
  sortBandsForDisplay,
  type CampaignInput,
} from "@/lib/affiliate/campaignConfig";

import { LibraryImagePicker } from "@/components/affiliate/LibraryImagePicker";

import {
  duplicateProductForCompetitionAction,
  setCampaignStatusAction,
  updateCampaignAction,
} from "../actions";
import { CAMPAIGN_HELP, type HelpEntry } from "./campaignHelp";
import { FieldHelp } from "./FieldHelp";

// WS-1i — the campaign builder form. Reworked into a GUIDED, sectioned setup: a
// section rail (Basics · Commission · Scoring · Prizes · Host trial) with a live
// per-section summary, and one focused card at a time instead of a single
// overwhelming scroll. Rates are entered as PERCENT here and stored as
// fractions; the server re-validates everything with the shared zod schema, so
// nothing here is trusted. (Competition rules are NOT set here — they are bound
// from the single-source-of-truth Legal docs on the Rules tab.)

type Band = { max: number | null; rate: number };
type PrizeKind = "placing" | "milestone" | "monthly";
type Prize = {
  placing?: number;
  cash?: number;
  floor?: number;
  milestone?: string;
  monthly_top_net_change?: number;
};

/** Which of the three prize shapes a stored prize is — drives the editor. */
function prizeKind(p: Prize): PrizeKind {
  if (p.milestone) return "milestone";
  if (p.monthly_top_net_change != null) return "monthly";
  return "placing";
}

const LABEL = "flabel";
const FIELD = "fld";

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in LOCAL time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
const zar = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

type TrialProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  annualPrice: number | null;
  currency: string;
  isVisible: boolean;
};

type SectionKey = "basics" | "commission" | "scoring" | "prizes" | "trial";

export function CampaignBuilder({
  campaignId,
  initial,
  enrolledActive,
  libraryImages,
  products = [],
  resultsPublished = false,
}: {
  campaignId: string;
  initial: CampaignInput;
  /** Places already taken — shown against the cap so it can't be set blind. */
  enrolledActive: number;
  /** Wielo media-library images the hero image can be assigned from. */
  libraryImages: { path: string; url: string }[];
  /** Membership products for the host-trial picker + duplicate sources. */
  products?: TrialProduct[];
  /** True once the final results are published — reopening is then withheld. */
  resultsPublished?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [section, setSection] = useState<SectionKey>("basics");

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [status, setStatus] = useState(initial.status);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial.ends_at));
  const [eligiblePartners, setEligiblePartners] = useState(
    initial.eligible_partners,
  );
  const [eligibleReferrals, setEligibleReferrals] = useState(
    initial.eligible_referrals,
  );
  const [maxParticipants, setMaxParticipants] = useState<string>(
    initial.max_participants != null ? String(initial.max_participants) : "",
  );
  const [hostOffer, setHostOffer] = useState(initial.host_offer ?? "");
  const [heroImage, setHeroImage] = useState<string | null>(
    initial.hero_image_url ?? null,
  );

  const cs = initial.commission_structure;
  const [model, setModel] = useState(cs.model);
  const [scope, setScope] = useState(cs.scope ?? "subscription");
  const [duration, setDuration] = useState(cs.duration ?? "lifetime");
  const [recurringPeriods, setRecurringPeriods] = useState(
    cs.recurring_periods ?? 12,
  );
  const [bands, setBands] = useState<Band[]>(
    sortBandsForDisplay(cs.bands ?? []),
  );
  const [flatRate, setFlatRate] = useState(cs.flat_rate ?? 0);
  const [flatType, setFlatType] = useState(cs.flat_type ?? "percent");

  const comp = initial.competition;
  const [scoringMode, setScoringMode] = useState(comp.scoring_mode ?? "total");
  const [countActiveOnly, setCountActiveOnly] = useState(
    comp.count_active_only ?? true,
  );
  const [eachListingCounts, setEachListingCounts] = useState(
    comp.each_listing_counts ?? true,
  );
  const [tieBreaker, setTieBreaker] = useState(comp.tie_breaker ?? "");
  const [visibility, setVisibility] = useState(
    comp.leaderboard_visibility ?? "public",
  );
  const [pointsPerListing, setPointsPerListing] = useState(
    comp.events?.listing_published ?? 1,
  );
  const [prizes, setPrizes] = useState<Prize[]>(comp.prizes ?? []);

  // ── Host free trial (competition.host_trial) ──────────────────────
  const ht = comp.host_trial ?? null;
  const [trialProductId, setTrialProductId] = useState(ht?.product_id ?? "");
  const [trialCohortEnd, setTrialCohortEnd] = useState(ht?.cohort_end ?? "");
  const [trialFloorDays, setTrialFloorDays] = useState(
    ht?.floor_days != null ? String(ht.floor_days) : "",
  );
  const [liveProducts, setLiveProducts] = useState<TrialProduct[]>(products);
  const [dupOpen, setDupOpen] = useState(false);
  // F5 · confirm dialog when a date shift on a live competition is refused.
  const [dateConfirmOpen, setDateConfirmOpen] = useState(false);
  const [dupSource, setDupSource] = useState(products[0]?.id ?? "");
  const [dupName, setDupName] = useState("");
  const [dupPrice, setDupPrice] = useState("");
  const [dupAnnual, setDupAnnual] = useState("");
  const [dupPending, startDup] = useTransition();

  const isLive = status === "active";

  // Plain-language, one-line summary of what a referral through this campaign
  // earns — shown on the Commission section and the rail so the money model is
  // never a guess.
  const commissionLine = useMemo(() => {
    if (model === "inherit") return "Standard per-product rates";
    if (model === "flat") {
      if (!flatRate) return "Flat rate — not set";
      return flatType === "amount"
        ? `Flat ${zar(flatRate)} per subscription`
        : `Flat ${rateToPct(flatRate)}%`;
    }
    const sorted = sortBandsForDisplay(bands);
    if (!sorted.length) return "Ladder — no rungs";
    const first = rateToPct(sorted[0]!.rate);
    const last = rateToPct(sorted[sorted.length - 1]!.rate);
    return `Ladder ${first}%→${last}% · ${sorted.length} rung${sorted.length === 1 ? "" : "s"}`;
  }, [model, flatRate, flatType, bands]);

  const durationLine =
    duration === "lifetime"
      ? "for life"
      : duration === "once"
        ? "on the first payment"
        : `for ${recurringPeriods} payments`;

  // The signup link is meant to be SENT to people, so copy it as an absolute
  // URL — a bare /signup/partner/x is useless once pasted into WhatsApp.
  const [copiedSignup, setCopiedSignup] = useState(false);
  async function copySignupLink(s: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/signup/partner/${s}`,
      );
      setCopiedSignup(true);
      toast.success("Signup link copied");
      setTimeout(() => setCopiedSignup(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it from the link instead.");
    }
  }

  function buildInput(nextStatus = status): CampaignInput {
    return {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      status: nextStatus,
      starts_at: fromLocalInput(startsAt),
      ends_at: fromLocalInput(endsAt),
      eligible_partners: eligiblePartners,
      eligible_referrals: eligibleReferrals,
      // Rules binding is managed on the Rules tab (bound from Legal docs), never
      // here — preserve whatever is currently bound so a Save can't wipe it.
      rules_doc_slug: initial.rules_doc_slug ?? null,
      max_participants: maxParticipants.trim()
        ? Math.max(1, Math.round(Number(maxParticipants)))
        : null,
      host_offer: hostOffer.trim() || null,
      hero_image_url: heroImage,
      commission_structure: {
        model,
        scope,
        duration,
        ...(duration === "recurring"
          ? { recurring_periods: Number(recurringPeriods) }
          : {}),
        ...(model === "ladder" ? { bands } : {}),
        ...(model === "flat"
          ? {
              flat_rate: Number(flatRate),
              flat_type: flatType,
            }
          : {}),
      },
      competition: {
        events: { listing_published: Number(pointsPerListing) },
        scoring_mode: scoringMode,
        count_active_only: countActiveOnly,
        each_listing_counts: eachListingCounts,
        ...(tieBreaker ? { tie_breaker: tieBreaker } : {}),
        leaderboard_visibility: visibility,
        prizes,
        // Only present when a product is assigned — clearing the picker removes
        // the trial (the update replaces `competition` wholesale).
        ...(trialProductId
          ? {
              host_trial: {
                product_id: trialProductId,
                cohort_end: trialCohortEnd.trim() || null,
                floor_days: trialFloorDays.trim()
                  ? Math.max(0, Math.round(Number(trialFloorDays)))
                  : null,
              },
            }
          : {}),
      },
    };
  }

  function runDuplicate() {
    const price = Number(dupPrice);
    if (!dupSource) {
      toast.error("Pick a product to duplicate.");
      return;
    }
    if (dupName.trim().length < 2) {
      toast.error("Give the new product a name.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid monthly price.");
      return;
    }
    startDup(async () => {
      const res = await duplicateProductForCompetitionAction({
        sourceProductId: dupSource,
        name: dupName.trim(),
        price,
        annualPrice: dupAnnual.trim() ? Number(dupAnnual) : null,
      });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Could not duplicate." : res.error);
        return;
      }
      // Add it to the picker and select it immediately.
      const created: TrialProduct = {
        id: res.data.id,
        name: res.data.name,
        slug: res.data.slug,
        price,
        annualPrice: dupAnnual.trim() ? Number(dupAnnual) : null,
        currency: "ZAR",
        isVisible: false,
      };
      setLiveProducts((p) => [...p, created]);
      setTrialProductId(created.id);
      setDupOpen(false);
      setDupName("");
      setDupPrice("");
      setDupAnnual("");
      toast.success(
        `Created “${created.name}”. Remember to Save the campaign.`,
      );
    });
  }

  function save(opts?: { confirmDateShift?: boolean }) {
    startTransition(async () => {
      const res = await updateCampaignAction({
        campaignId,
        input: buildInput(),
        ...(opts?.confirmDateShift ? { confirmDateShift: true } : {}),
      });
      if (res.ok) {
        toast.success("Campaign saved.");
        setDateConfirmOpen(false);
        router.refresh();
        return;
      }
      // F5 · the server refused a live-campaign date shift — ask to confirm.
      if (res.needsConfirm === "date_shift") {
        setDateConfirmOpen(true);
        return;
      }
      toast.error(res.error);
    });
  }

  function changeStatus(next: "draft" | "active" | "ended" | "archived") {
    startTransition(async () => {
      const res = await setCampaignStatusAction({ campaignId, status: next });
      if (res.ok) {
        setStatus(next);
        toast.success(
          next === "active"
            ? "Campaign is live — partners can enrol and the leaderboard is public."
            : `Campaign set to ${next}.`,
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const SECTIONS: {
    key: SectionKey;
    label: string;
    icon: LucideIcon;
    summary: string;
    warn?: boolean;
  }[] = [
    {
      key: "basics",
      label: "Basics",
      icon: SlidersHorizontal,
      summary: `/${slug || "…"}`,
      warn: name.trim().length < 2 || slug.trim().length < 2,
    },
    {
      key: "commission",
      label: "Commission",
      icon: Coins,
      summary: commissionLine,
      warn:
        model !== "inherit" &&
        ((model === "flat" && !flatRate) ||
          (model === "ladder" && !bands.some((b) => b.rate > 0))),
    },
    {
      key: "scoring",
      label: "Scoring",
      icon: Trophy,
      summary: `${scoringMode === "net_change" ? "Net change" : "Total live"} · ${visibility}`,
    },
    {
      key: "prizes",
      label: "Prizes",
      icon: Gift,
      summary: prizes.length
        ? `${prizes.length} prize${prizes.length === 1 ? "" : "s"}`
        : "None yet",
    },
    {
      key: "trial",
      label: "Host trial",
      icon: Rocket,
      summary: trialProductId
        ? (liveProducts.find((p) => p.id === trialProductId)?.name ?? "Set")
        : "None",
    },
  ];

  return (
    <div className="space-y-5">
      {/* ---- Status + primary actions ---- */}
      <div className="am-card flex flex-wrap items-center gap-3 p-4">
        <span className={`tag ${isLive ? "green" : "gray"}`}>
          <span className="d" />
          <span className="capitalize">{status}</span>
        </span>
        <span className="text-[12.5px] text-brand-mute">
          {isLive
            ? "Enrolled partners are earning this campaign's rates."
            : "Nothing is paid at campaign rates while it is not live."}
          <FieldHelp help={CAMPAIGN_HELP.status} />
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {status === "active" ? (
            <>
              <button
                type="button"
                onClick={() => changeStatus("draft")}
                disabled={pending}
                className="btn-sec h-9"
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
              <button
                type="button"
                onClick={() => changeStatus("ended")}
                disabled={pending}
                className="btn-sec h-9"
              >
                End campaign
              </button>
            </>
          ) : status === "draft" ? (
            <button
              type="button"
              onClick={() => changeStatus("active")}
              disabled={pending}
              className="btn-pri h-9"
            >
              <Play className="h-4 w-4" />
              Launch campaign
            </button>
          ) : status === "ended" ? (
            <>
              {/* A published final is a public record — reopening it is withheld. */}
              {!resultsPublished ? (
                <button
                  type="button"
                  onClick={() => changeStatus("active")}
                  disabled={pending}
                  className="btn-sec h-9"
                >
                  <Play className="h-4 w-4" />
                  Reopen
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => changeStatus("archived")}
                disabled={pending}
                className="btn-sec h-9"
              >
                Archive
              </button>
            </>
          ) : (
            // archived
            <button
              type="button"
              onClick={() => changeStatus("draft")}
              disabled={pending}
              className="btn-sec h-9"
            >
              Restore to draft
            </button>
          )}
          <button
            type="button"
            onClick={() => save()}
            disabled={pending}
            className="btn-pri h-9"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {isLive ? (
        <div className="flex items-start gap-2 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-[12.5px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This campaign is live. Changing the ladder or prizes changes what
            enrolled partners earn from now on — every edit is recorded in the
            audit log.
          </span>
        </div>
      ) : null}

      {status === "ended" ? (
        <div className="flex items-start gap-2 rounded-[14px] border border-brand-line bg-brand-light p-4 text-[12.5px] text-brand-mute">
          <Flag className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          <span>
            This campaign has ended.{" "}
            {resultsPublished
              ? "The final results are published on the public leaderboard."
              : "Review and publish the winners on the Results tab — nothing is public until you do."}
          </span>
        </div>
      ) : null}

      {/* ---- Section rail + focused panel ---- */}
      <div className="grid gap-5 lg:grid-cols-[232px_minmax(0,1fr)]">
        {/* Rail — vertical on desktop, horizontal scroll on mobile. */}
        <nav className="thin-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const on = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={`group flex shrink-0 items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-left transition lg:shrink ${
                  on
                    ? "border-brand-primary/40 bg-brand-primary/[0.06]"
                    : "border-brand-line bg-white hover:border-brand-primary/30 hover:bg-brand-light/50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${
                    on
                      ? "bg-brand-primary text-white"
                      : "bg-brand-light text-brand-mute group-hover:text-brand-primary"
                  }`}
                >
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-[13.5px] font-semibold ${on ? "text-brand-ink" : "text-brand-ink"}`}
                    >
                      {s.label}
                    </span>
                    {s.warn ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : null}
                  </span>
                  <span className="mono block max-w-[150px] truncate text-[11px] text-brand-mute">
                    {s.summary}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active section */}
        <div className="min-w-0">
          {section === "basics" ? (
            <Panel
              title="Basics"
              sub="Name, link, dates and who can take part."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>
                    Name
                    <FieldHelp help={CAMPAIGN_HELP.name} />
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Public link
                    <FieldHelp help={CAMPAIGN_HELP.slug} />
                  </span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className={`${FIELD} font-mono text-[13px]`}
                  />
                  {/* Open the real public page in a new tab — the founder should
                      see exactly what a visitor sees, not a description of it. */}
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-mute">
                    <a
                      href={`/competitions/${slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline"
                    >
                      /competitions/{slug || "…"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {isLive ? (
                      <span>· live now</span>
                    ) : (
                      <span className="text-status-pending">
                        · visitors get a 404 until you launch
                      </span>
                    )}
                  </span>
                  {/* The partner signup link for THIS competition. */}
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-mute">
                    <a
                      href={`/signup/partner/${slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline"
                    >
                      /signup/partner/{slug || "…"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => copySignupLink(slug)}
                      className="inline-flex items-center gap-1 font-medium text-brand-mute hover:text-brand-primary hover:underline"
                    >
                      {copiedSignup ? (
                        <>
                          <Check className="h-3 w-3" /> copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> copy
                        </>
                      )}
                    </button>
                    <span>
                      {isLive
                        ? "· signup link — enters them in this race"
                        : "· works, but won't enter anyone until you launch"}
                    </span>
                  </span>
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Starts
                    <FieldHelp help={CAMPAIGN_HELP.starts} />
                  </span>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Ends
                    <FieldHelp help={CAMPAIGN_HELP.ends} />
                  </span>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Who can join
                    <FieldHelp help={CAMPAIGN_HELP.eligiblePartners} />
                  </span>
                  <select
                    value={eligiblePartners}
                    onChange={(e) =>
                      setEligiblePartners(
                        e.target.value as typeof eligiblePartners,
                      )
                    }
                    className={FIELD}
                  >
                    {ELIGIBLE_PARTNERS.map((v) => (
                      <option key={v} value={v}>
                        {v === "all"
                          ? "Every partner"
                          : v === "tagged"
                            ? "Tagged partners only"
                            : "Invite only"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Which referrals count
                    <FieldHelp help={CAMPAIGN_HELP.eligibleReferrals} />
                  </span>
                  <select
                    value={eligibleReferrals}
                    onChange={(e) =>
                      setEligibleReferrals(
                        e.target.value as typeof eligibleReferrals,
                      )
                    }
                    className={FIELD}
                  >
                    {ELIGIBLE_REFERRALS.map((v) => (
                      <option key={v} value={v}>
                        {v === "all_time"
                          ? "All of their referrals, ever"
                          : v === "referred_in_window"
                            ? "Referred during the campaign"
                            : "Went live during the campaign"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Places available
                    <FieldHelp help={CAMPAIGN_HELP.maxParticipants} />
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={maxParticipants}
                    placeholder="Unlimited"
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className={FIELD}
                  />
                  <span className="mt-1 block text-[11px] text-brand-mute">
                    {maxParticipants.trim() ? (
                      <>
                        {enrolledActive} of {maxParticipants} taken
                        {Number(maxParticipants) <= enrolledActive ? (
                          <span className="text-status-pending">
                            {" "}
                            · full, no new partners can join
                          </span>
                        ) : (
                          <>
                            {" "}
                            · {Number(maxParticipants) - enrolledActive} left
                          </>
                        )}
                      </>
                    ) : (
                      <>Leave blank for unlimited · {enrolledActive} enrolled</>
                    )}
                  </span>
                </label>

                <label className="block sm:col-span-2">
                  <span className={LABEL}>Offer shown to hosts</span>
                  <input
                    type="text"
                    maxLength={60}
                    value={hostOffer}
                    placeholder="e.g. 4 months free"
                    onChange={(e) => setHostOffer(e.target.value)}
                    className={FIELD}
                  />
                  <span className="mt-1 block text-[11px] text-brand-mute">
                    Appears on every partner&rsquo;s landing page
                    (/partners/&lt;their-slug&gt;) as the reason to sign up now.
                    This is a commercial promise published under a
                    partner&rsquo;s name and photo — leave it blank and the page
                    makes no pricing claim at all, rather than inventing one.
                  </span>
                </label>

                <label className="block sm:col-span-2">
                  <span className={LABEL}>Hero image</span>
                  <div className="mt-1">
                    <LibraryImagePicker
                      images={libraryImages}
                      value={heroImage}
                      onChange={setHeroImage}
                    />
                  </div>
                  <span className="mt-1 block text-[11px] text-brand-mute">
                    Assigned from the Wielo media library — shows as the
                    background of the public leaderboard
                    (/competitions/&lt;slug&gt;). Leave empty for the plain dark
                    hero.
                  </span>
                </label>
              </div>

              <RulesHint />
            </Panel>
          ) : null}

          {section === "commission" ? (
            <Panel
              title="Commission"
              sub="What enrolled partners earn while this campaign runs."
            >
              <div className="mb-4 rounded-[12px] border border-brand-primary/25 bg-brand-primary/[0.05] px-4 py-3 text-[13px] text-brand-ink">
                A referral through this campaign earns{" "}
                <strong>{commissionLine}</strong> {durationLine}.
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={LABEL}>
                    Model
                    <FieldHelp help={CAMPAIGN_HELP.model} />
                  </span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as typeof model)}
                    className={FIELD}
                  >
                    {COMMISSION_MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m === "ladder"
                          ? "Ladder (rate rises with their book)"
                          : m === "flat"
                            ? "Flat rate"
                            : "Inherit the standard rates"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Paid for how long
                    <FieldHelp help={CAMPAIGN_HELP.duration} />
                  </span>
                  <select
                    value={duration}
                    onChange={(e) =>
                      setDuration(e.target.value as typeof duration)
                    }
                    className={FIELD}
                  >
                    {COMMISSION_DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d === "once"
                          ? "One payment only"
                          : d === "recurring"
                            ? "A set number of payments"
                            : "For as long as the host pays"}
                      </option>
                    ))}
                  </select>
                </label>
                {duration === "recurring" ? (
                  <label className="block">
                    <span className={LABEL}>
                      Number of payments
                      <FieldHelp help={CAMPAIGN_HELP.recurringPeriods} />
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={recurringPeriods}
                      onChange={(e) =>
                        setRecurringPeriods(Number(e.target.value))
                      }
                      className={FIELD}
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className={LABEL}>
                      Applies to
                      <FieldHelp help={CAMPAIGN_HELP.scope} />
                    </span>
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      className={FIELD}
                    >
                      {COMMISSION_SCOPES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {model === "ladder" ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <span className={LABEL}>
                      Ladder rungs
                      <FieldHelp help={CAMPAIGN_HELP.bands} />
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setBands((b) => [...b, { max: 10_000, rate: 0.1 }])
                      }
                      className="btn-ghost h-8"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add rung
                    </button>
                  </div>
                  <p className="mt-1 text-[12px] text-brand-mute">
                    Monthly subscription revenue from their hosts, up to the
                    ceiling, pays that rate on the whole book. Exactly one rung
                    must have no ceiling — that is the top rate.
                  </p>
                  <div className="mt-3 space-y-2">
                    {bands.map((b, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="w-16 text-[12px] text-brand-mute">
                          Up to
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          value={b.max ?? ""}
                          placeholder="No ceiling (top rung)"
                          onChange={(e) =>
                            setBands((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      max: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    }
                                  : x,
                              ),
                            )
                          }
                          className="w-44 rounded-[10px] border border-brand-line px-3 py-1.5 text-sm outline-none focus:border-brand-primary"
                        />
                        <span className="text-[12px] text-brand-mute">
                          pays
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={rateToPct(b.rate)}
                          onChange={(e) =>
                            setBands((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      rate: pctToRate(Number(e.target.value)),
                                    }
                                  : x,
                              ),
                            )
                          }
                          className="w-24 rounded-[10px] border border-brand-line px-3 py-1.5 text-sm outline-none focus:border-brand-primary"
                        />
                        <span className="text-[12px] text-brand-mute">%</span>
                        <button
                          type="button"
                          onClick={() =>
                            setBands((prev) => prev.filter((_, j) => j !== i))
                          }
                          aria-label="Remove rung"
                          className="rounded-pill p-1.5 text-brand-mute hover:bg-brand-light hover:text-status-cancelled"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {bands.length === 0 ? (
                      <p className="text-[12.5px] text-brand-mute">
                        No rungs yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {model === "flat" ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL}>
                      Flat rate
                      <FieldHelp help={CAMPAIGN_HELP.flatRate} />
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={flatType === "amount" ? 10 : 0.5}
                      value={
                        flatType === "amount" ? flatRate : rateToPct(flatRate)
                      }
                      onChange={(e) =>
                        setFlatRate(
                          flatType === "amount"
                            ? Number(e.target.value)
                            : pctToRate(Number(e.target.value)),
                        )
                      }
                      className={FIELD}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL}>Rate type</span>
                    <select
                      value={flatType}
                      onChange={(e) =>
                        setFlatType(e.target.value as typeof flatType)
                      }
                      className={FIELD}
                    >
                      <option value="percent">
                        Percent of what the host pays
                      </option>
                      <option value="amount">Fixed rand amount</option>
                    </select>
                  </label>
                </div>
              ) : null}

              {model === "inherit" ? (
                <p className="mt-5 rounded-[10px] bg-brand-light/60 p-3 text-[12.5px] text-brand-mute">
                  Partners earn the standard per-product commission from their
                  normal link — this campaign adds the competition and
                  leaderboard, but no special rate.
                </p>
              ) : null}
            </Panel>
          ) : null}

          {section === "scoring" ? (
            <Panel
              title="Scoring"
              sub="How partners are ranked on the leaderboard."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={LABEL}>
                    Scoring
                    <FieldHelp help={CAMPAIGN_HELP.scoring} />
                  </span>
                  <select
                    value={scoringMode}
                    onChange={(e) =>
                      setScoringMode(e.target.value as typeof scoringMode)
                    }
                    className={FIELD}
                  >
                    {SCORING_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m === "total"
                          ? "Total live listings"
                          : "Net change over the period"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Leaderboard
                    <FieldHelp help={CAMPAIGN_HELP.leaderboard} />
                  </span>
                  <select
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as typeof visibility)
                    }
                    className={FIELD}
                  >
                    {LEADERBOARD_VISIBILITY.map((v) => (
                      <option key={v} value={v}>
                        {v === "public"
                          ? "Public — anyone can view"
                          : v === "partners"
                            ? "Partners only"
                            : "Hidden"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>
                    Points per live listing
                    <FieldHelp help={CAMPAIGN_HELP.pointsPerListing} />
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={pointsPerListing}
                    onChange={(e) =>
                      setPointsPerListing(Number(e.target.value))
                    }
                    className={FIELD}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-5">
                <Toggle
                  checked={countActiveOnly}
                  onChange={setCountActiveOnly}
                  label="Only count hosts who are still live"
                  help={CAMPAIGN_HELP.countActiveOnly}
                />
                <Toggle
                  checked={eachListingCounts}
                  onChange={setEachListingCounts}
                  label="Every listing counts, not just every host"
                  help={CAMPAIGN_HELP.eachListingCounts}
                />
              </div>

              <label className="mt-4 block sm:max-w-sm">
                <span className={LABEL}>
                  Tie breaker
                  <FieldHelp help={CAMPAIGN_HELP.tieBreaker} />
                </span>
                <select
                  value={tieBreaker}
                  onChange={(e) => setTieBreaker(e.target.value)}
                  className={FIELD}
                >
                  <option value="">No tie breaker stated</option>
                  {TIE_BREAKERS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </Panel>
          ) : null}

          {section === "prizes" ? (
            <Panel
              title="Prizes"
              sub="Cash prizes, awarded on the Results tab when the race is judged."
            >
              <div className="flex items-center justify-between">
                <span className={LABEL}>
                  Prize list
                  <FieldHelp help={CAMPAIGN_HELP.prizes} />
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPrizes((p) => [
                      ...p,
                      {
                        placing:
                          p.filter((x) => prizeKind(x) === "placing").length +
                          1,
                      },
                    ])
                  }
                  className="btn-ghost h-8"
                >
                  <Plus className="h-3.5 w-3.5" /> Add prize
                </button>
              </div>
              <p className="mt-1 text-[12px] text-brand-mute">
                Pick what each prize is for. Prizes are cash and are paid from
                the Results tab once you publish the winners.
              </p>
              <div className="mt-3 space-y-2.5">
                {prizes.map((p, i) => {
                  const kind = prizeKind(p);
                  const setPrize = (patch: Partial<Prize>) =>
                    setPrizes((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                    );
                  const changeKind = (k: PrizeKind) =>
                    setPrizes((prev) =>
                      prev.map((x, j) => {
                        if (j !== i) return x;
                        // Reset to a clean shape for the chosen kind, keeping cash.
                        const cash = x.cash;
                        if (k === "placing")
                          return { placing: (x.placing ?? 1) || 1, cash };
                        if (k === "milestone")
                          return { milestone: x.milestone ?? "", cash };
                        return {
                          monthly_top_net_change: x.monthly_top_net_change ?? 0,
                        };
                      }),
                    );
                  return (
                    <div
                      key={i}
                      className="rounded-[13px] border border-brand-line p-3"
                    >
                      <div className="flex flex-wrap items-end gap-2.5">
                        <label className="block">
                          <span className="text-[10px] text-brand-mute">
                            Prize for
                          </span>
                          <select
                            value={kind}
                            onChange={(e) =>
                              changeKind(e.target.value as PrizeKind)
                            }
                            className="mt-0.5 w-40 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                          >
                            <option value="placing">A finishing place</option>
                            <option value="milestone">A milestone</option>
                            <option value="monthly">Monthly top mover</option>
                          </select>
                        </label>

                        {kind === "placing" ? (
                          <label className="block">
                            <span className="text-[10px] text-brand-mute">
                              Place
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={p.placing ?? ""}
                              onChange={(e) =>
                                setPrize({
                                  placing: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              className="mt-0.5 w-20 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                            />
                          </label>
                        ) : null}

                        {kind === "milestone" ? (
                          <label className="block flex-1">
                            <span className="text-[10px] text-brand-mute">
                              Milestone
                            </span>
                            <select
                              value={p.milestone ?? ""}
                              onChange={(e) =>
                                setPrize({
                                  milestone: e.target.value || undefined,
                                })
                              }
                              className="mt-0.5 w-full min-w-[10rem] rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                            >
                              <option value="">Choose a milestone…</option>
                              {MILESTONES.map((m) => (
                                <option key={m.key} value={m.key}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        <label className="block">
                          <span className="text-[10px] text-brand-mute">
                            Cash (R)
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={
                              kind === "monthly"
                                ? (p.monthly_top_net_change ?? "")
                                : (p.cash ?? "")
                            }
                            onChange={(e) => {
                              const v = e.target.value
                                ? Number(e.target.value)
                                : undefined;
                              setPrize(
                                kind === "monthly"
                                  ? { monthly_top_net_change: v }
                                  : { cash: v },
                              );
                            }}
                            className="mt-0.5 w-28 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                          />
                        </label>

                        {/* Rate floor is a LADDER-only mechanic (locks a minimum
                            rate for life). Hidden on flat/inherit campaigns so the
                            common case stays clean. */}
                        {kind === "placing" && model === "ladder" ? (
                          <label className="block">
                            <span className="text-[10px] text-brand-mute">
                              Rate floor (%)
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={
                                p.floor !== undefined ? rateToPct(p.floor) : ""
                              }
                              onChange={(e) =>
                                setPrize({
                                  floor: e.target.value
                                    ? pctToRate(Number(e.target.value))
                                    : undefined,
                                })
                              }
                              className="mt-0.5 w-24 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                            />
                          </label>
                        ) : null}

                        <button
                          type="button"
                          onClick={() =>
                            setPrizes((prev) => prev.filter((_, j) => j !== i))
                          }
                          aria-label="Remove prize"
                          className="ml-auto rounded-pill p-1.5 text-brand-mute hover:bg-brand-light hover:text-status-cancelled"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-[11.5px] text-brand-mute">
                        {describePrize(p, kind)}
                      </p>
                    </div>
                  );
                })}
                {prizes.length === 0 ? (
                  <p className="text-[12.5px] text-brand-mute">
                    No prizes yet.
                  </p>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {section === "trial" ? (
            <Panel
              title="Host free trial"
              sub="What a referred host gets when they sign up during this competition. Assign a dedicated (hidden) product priced at the competition rate — the public plan is never changed."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Trial product</span>
                  <select
                    value={trialProductId}
                    onChange={(e) => setTrialProductId(e.target.value)}
                    className={FIELD}
                  >
                    <option value="">
                      No trial — referred hosts pay as normal
                    </option>
                    {liveProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.isVisible ? " (public)" : " (hidden)"} — R
                        {Math.round(p.price).toLocaleString("en-ZA")}
                        /mo
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[12px] text-brand-mute">
                    Referred hosts get full access to this product free until
                    the trial ends, then pay its price. Tip: duplicate your paid
                    plan so the public one stays untouched.
                  </span>
                </label>

                <div className="block">
                  <span className={LABEL}>Or make one</span>
                  {dupOpen ? (
                    <div className="rounded-card border border-brand-line p-3">
                      <select
                        value={dupSource}
                        onChange={(e) => setDupSource(e.target.value)}
                        className={FIELD}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            Duplicate: {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={dupName}
                        onChange={(e) => setDupName(e.target.value)}
                        placeholder="New product name (e.g. Founder)"
                        className={`${FIELD} mt-2`}
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          value={dupPrice}
                          onChange={(e) => setDupPrice(e.target.value)}
                          placeholder="Monthly R"
                          className={FIELD}
                        />
                        <input
                          type="number"
                          min={0}
                          value={dupAnnual}
                          onChange={(e) => setDupAnnual(e.target.value)}
                          placeholder="Annual R (optional)"
                          className={FIELD}
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={runDuplicate}
                          disabled={dupPending}
                          className="btn-pri h-9"
                        >
                          <Copy className="h-4 w-4" />
                          {dupPending ? "Creating…" : "Create & assign"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDupOpen(false)}
                          className="btn-ghost h-9"
                        >
                          Cancel
                        </button>
                      </div>
                      <span className="mt-2 block text-[12px] text-brand-mute">
                        Creates a hidden copy (all features + rules carried
                        over) at the price you set. Edit it later under Admin →
                        Products.
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDupSource(products[0]?.id ?? "");
                        setDupOpen(true);
                      }}
                      className="btn-ghost h-10"
                      disabled={products.length === 0}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate a product for this competition
                    </button>
                  )}
                </div>
              </div>

              {trialProductId ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL}>
                      Free access ends (cohort date)
                    </span>
                    <input
                      type="date"
                      value={trialCohortEnd}
                      onChange={(e) => setTrialCohortEnd(e.target.value)}
                      className={FIELD}
                    />
                    <span className="mt-1 block text-[12px] text-brand-mute">
                      Every host in the cohort loses free access on this date,
                      whenever they joined.
                    </span>
                  </label>
                  <label className="block">
                    <span className={LABEL}>
                      Minimum free days (rolling floor)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={trialFloorDays}
                      onChange={(e) => setTrialFloorDays(e.target.value)}
                      placeholder="e.g. 30"
                      className={FIELD}
                    />
                    <span className="mt-1 block text-[12px] text-brand-mute">
                      Late joiners still get at least this many days. Trial ends
                      at the later of the two — max(cohort date, join + floor
                      days).
                    </span>
                  </label>
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </div>

      {/* F5 · confirm moving the scoring window on a live competition. */}
      {dateConfirmOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDateConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-card border border-brand-line bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-brand-line px-5 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  Shift the scoring window?
                </div>
                <p className="mt-1 text-[12.5px] text-brand-mute">
                  This competition is live. Changing the start or end date moves
                  the scoring window and can change who wins. Partners&rsquo;
                  already-earned commission rates are unaffected, but standings
                  and prizes may change.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3">
              <button
                type="button"
                onClick={() => setDateConfirmOpen(false)}
                className="btn-ghost h-9"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => save({ confirmDateShift: true })}
                disabled={pending}
                className="btn-pri h-9"
              >
                {pending ? "Saving…" : "Save anyway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One plain-language line describing a prize, for the editor. */
function describePrize(p: Prize, kind: PrizeKind): string {
  if (kind === "monthly") {
    const c = p.monthly_top_net_change;
    return c
      ? `${zar(c)} each month to the biggest net gainer that month.`
      : "Monthly cash to the biggest net gainer — set the amount.";
  }
  if (kind === "milestone") {
    const label =
      MILESTONES.find((m) => m.key === p.milestone)?.label ?? "a milestone";
    const c = p.cash ? zar(p.cash) : "cash";
    return p.milestone
      ? `${c} to the partner who hits: ${label}.`
      : "Choose a milestone and set the cash.";
  }
  // placing
  const place = p.placing ? ordinal(p.placing) : "a";
  const c = p.cash ? zar(p.cash) : "cash";
  const floor =
    p.floor !== undefined
      ? ` plus a permanent ${rateToPct(p.floor)}% rate floor`
      : "";
  return `${c} to the ${place} place finisher${floor}.`;
}

/** Small pointer telling the founder rules live on the Rules tab (SSOT), not
 *  here — closes the "where do I set the rules?" gap the old dropdown created. */
function RulesHint() {
  return (
    <p className="mt-5 flex items-start gap-2 rounded-[10px] border border-brand-line bg-brand-light/50 p-3 text-[12px] text-brand-mute">
      <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
      <span>
        Competition rules are managed on the <strong>Rules</strong> tab — bound
        from the single source of truth in Legal docs, so they stay at one fixed
        public URL for the whole campaign.
      </span>
    </p>
  );
}

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="am-card p-5">
      <h2 className="font-display text-[15px] font-bold text-brand-ink">
        {title}
      </h2>
      {sub ? (
        <p className="mt-0.5 text-[12.5px] text-brand-mute">{sub}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help?: HelpEntry;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-brand-ink">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
        {label}
      </label>
      {help ? <FieldHelp help={help} /> : null}
    </span>
  );
}
