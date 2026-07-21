"use client";

import {
  AlertTriangle,
  ExternalLink,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

import { setCampaignStatusAction, updateCampaignAction } from "../actions";
import { CAMPAIGN_HELP, FieldHelp, type HelpEntry } from "./FieldHelp";

// WS-1i — the campaign builder form. Rates are entered as PERCENT here and
// stored as fractions; the server re-validates everything with the shared zod
// schema, so nothing here is trusted.

type Band = { max: number | null; rate: number };
type Prize = {
  placing?: number;
  cash?: number;
  floor?: number;
  milestone?: string;
  monthly_top_net_change?: number;
};

const LABEL =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute";
const FIELD =
  "mt-1 w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-primary";

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

export function CampaignBuilder({
  campaignId,
  initial,
  legalDocs,
  enrolledActive,
}: {
  campaignId: string;
  initial: CampaignInput;
  legalDocs: { slug: string; title: string }[];
  /** Places already taken — shown against the cap so it can't be set blind. */
  enrolledActive: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
  const [rulesDoc, setRulesDoc] = useState(initial.rules_doc_slug ?? "");
  const [maxParticipants, setMaxParticipants] = useState<string>(
    initial.max_participants != null ? String(initial.max_participants) : "",
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
  const [bonusMonthly, setBonusMonthly] = useState(
    cs.conversion_bonus?.monthly ?? 0,
  );
  const [bonusAnnual, setBonusAnnual] = useState(
    cs.conversion_bonus?.annual ?? 0,
  );

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

  const isLive = status === "active";

  function buildInput(nextStatus = status): CampaignInput {
    return {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      status: nextStatus,
      starts_at: fromLocalInput(startsAt),
      ends_at: fromLocalInput(endsAt),
      eligible_partners: eligiblePartners,
      eligible_referrals: eligibleReferrals,
      rules_doc_slug: rulesDoc || null,
      max_participants: maxParticipants.trim()
        ? Math.max(1, Math.round(Number(maxParticipants)))
        : null,
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
        ...(bonusMonthly || bonusAnnual
          ? {
              conversion_bonus: {
                monthly: Number(bonusMonthly),
                annual: Number(bonusAnnual),
              },
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
      },
    };
  }

  function save() {
    startTransition(async () => {
      const res = await updateCampaignAction({
        campaignId,
        input: buildInput(),
      });
      if (res.ok) {
        toast.success("Campaign saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
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

  return (
    <div className="space-y-5">
      {/* ---- Status bar ---- */}
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-brand-line bg-white p-4 shadow-card">
        <span
          className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
            isLive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-brand-line bg-brand-light text-brand-mute"
          }`}
        >
          {status}
        </span>
        <span className="text-[12.5px] text-brand-mute">
          {isLive
            ? "Enrolled partners are earning this campaign's rates."
            : "Nothing is paid at campaign rates while it is not live."}
          <FieldHelp help={CAMPAIGN_HELP.status} />
        </span>
        <div className="ml-auto flex gap-2">
          {isLive ? (
            <>
              <button
                type="button"
                onClick={() => changeStatus("draft")}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-4 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light disabled:opacity-50"
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
              <button
                type="button"
                onClick={() => changeStatus("ended")}
                disabled={pending}
                className="rounded-pill border border-brand-line px-4 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light disabled:opacity-50"
              >
                End campaign
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => changeStatus("active")}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Launch campaign
            </button>
          )}
        </div>
      </div>

      {isLive ? (
        <div className="flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 p-4 text-[12.5px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This campaign is live. Changing the ladder or prizes changes what
            enrolled partners earn from now on — every edit is recorded in the
            audit log.
          </span>
        </div>
      ) : null}

      {/* ---- Basics ---- */}
      <Panel title="Basics">
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
            {/* Open the real public page in a new tab — the founder should be
                able to see exactly what a visitor sees, not a description of it. */}
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
                setEligiblePartners(e.target.value as typeof eligiblePartners)
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
                setEligibleReferrals(e.target.value as typeof eligibleReferrals)
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
                    <> · {Number(maxParticipants) - enrolledActive} left</>
                  )}
                </>
              ) : (
                <>Leave blank for unlimited · {enrolledActive} enrolled</>
              )}
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className={LABEL}>
              Rules document
              <FieldHelp help={CAMPAIGN_HELP.rulesDoc} />
            </span>
            <select
              value={rulesDoc}
              onChange={(e) => setRulesDoc(e.target.value)}
              className={FIELD}
            >
              <option value="">No rules page linked</option>
              {legalDocs.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.title} (/legal/{d.slug})
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-brand-mute">
              Competition rules must stay at a fixed URL for the whole campaign
              — publish them as a legal document and link them here.
            </span>
          </label>
        </div>
      </Panel>

      {/* ---- Commission ---- */}
      <Panel
        title="Commission"
        sub="What enrolled partners earn while this campaign runs."
      >
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
              onChange={(e) => setDuration(e.target.value as typeof duration)}
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
                onChange={(e) => setRecurringPeriods(Number(e.target.value))}
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
                className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-3 py-1 text-[12px] font-medium text-brand-ink hover:bg-brand-light"
              >
                <Plus className="h-3.5 w-3.5" /> Add rung
              </button>
            </div>
            <p className="mt-1 text-[12px] text-brand-mute">
              Monthly subscription revenue from their hosts, up to the ceiling,
              pays that rate on the whole book. Exactly one rung must have no
              ceiling — that is the top rate.
            </p>
            <div className="mt-3 space-y-2">
              {bands.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
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
                  <span className="text-[12px] text-brand-mute">pays</span>
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
                            ? { ...x, rate: pctToRate(Number(e.target.value)) }
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
                <p className="text-[12.5px] text-brand-mute">No rungs yet.</p>
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
                value={flatType === "amount" ? flatRate : rateToPct(flatRate)}
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
                onChange={(e) => setFlatType(e.target.value as typeof flatType)}
                className={FIELD}
              >
                <option value="percent">Percent of what the host pays</option>
                <option value="amount">Fixed rand amount</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>
              Conversion bonus — monthly plan (R)
              <FieldHelp help={CAMPAIGN_HELP.conversionBonus} />
            </span>
            <input
              type="number"
              min={0}
              value={bonusMonthly}
              onChange={(e) => setBonusMonthly(Number(e.target.value))}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Conversion bonus — annual plan (R)</span>
            <input
              type="number"
              min={0}
              value={bonusAnnual}
              onChange={(e) => setBonusAnnual(Number(e.target.value))}
              className={FIELD}
            />
          </label>
        </div>
      </Panel>

      {/* ---- Competition ---- */}
      <Panel
        title="Competition"
        sub="How partners are scored and what they win."
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
              onChange={(e) => setPointsPerListing(Number(e.target.value))}
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

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className={LABEL}>
              Prizes
              <FieldHelp help={CAMPAIGN_HELP.prizes} />
            </span>
            <button
              type="button"
              onClick={() =>
                setPrizes((p) => [...p, { placing: p.length + 1 }])
              }
              className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-3 py-1 text-[12px] font-medium text-brand-ink hover:bg-brand-light"
            >
              <Plus className="h-3.5 w-3.5" /> Add prize
            </button>
          </div>
          <p className="mt-1 text-[12px] text-brand-mute">
            A floor permanently locks that partner&apos;s minimum commission
            rate — it outlives the campaign. Leave the placing blank for a
            milestone prize.
          </p>
          <div className="mt-3 space-y-2">
            {prizes.map((p, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 rounded-card border border-brand-line p-3"
              >
                <label className="block">
                  <span className="text-[10px] text-brand-mute">Place</span>
                  <input
                    type="number"
                    min={1}
                    value={p.placing ?? ""}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                placing: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              }
                            : x,
                        ),
                      )
                    }
                    className="mt-0.5 w-20 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-brand-mute">Cash (R)</span>
                  <input
                    type="number"
                    min={0}
                    value={p.cash ?? ""}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                cash: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              }
                            : x,
                        ),
                      )
                    }
                    className="mt-0.5 w-28 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-brand-mute">
                    Rate floor (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={p.floor !== undefined ? rateToPct(p.floor) : ""}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                floor: e.target.value
                                  ? pctToRate(Number(e.target.value))
                                  : undefined,
                              }
                            : x,
                        ),
                      )
                    }
                    className="mt-0.5 w-28 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-brand-mute">
                    Monthly top mover (R)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={p.monthly_top_net_change ?? ""}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                monthly_top_net_change: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              }
                            : x,
                        ),
                      )
                    }
                    className="mt-0.5 w-32 rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="block flex-1">
                  <span className="text-[10px] text-brand-mute">
                    Milestone (optional)
                  </span>
                  <select
                    value={p.milestone ?? ""}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? { ...x, milestone: e.target.value || undefined }
                            : x,
                        ),
                      )
                    }
                    className="mt-0.5 w-full min-w-[9rem] rounded-[10px] border border-brand-line px-2 py-1.5 text-sm outline-none focus:border-brand-primary"
                  >
                    <option value="">Not a milestone prize</option>
                    {MILESTONES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setPrizes((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label="Remove prize"
                  className="rounded-pill p-1.5 text-brand-mute hover:bg-brand-light hover:text-status-cancelled"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {prizes.length === 0 ? (
              <p className="text-[12.5px] text-brand-mute">No prizes yet.</p>
            ) : null}
          </div>
        </div>
      </Panel>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save campaign"}
        </button>
      </div>
    </div>
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
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
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
