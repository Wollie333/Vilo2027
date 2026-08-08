"use client";

import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarRange,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Home as HomeIcon,
  Image as ImageIcon,
  LayoutDashboard,
  Link as LinkIcon,
  type LucideIcon,
  PartyPopper,
  Rocket,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { BusyOverlay } from "@/components/ui/BusyOverlay";
import { computeSetupCompletion } from "@/lib/setup/completion";

import type { Account } from "@/app/[locale]/dashboard/settings/banking/_components/BankAccountList";
import type { BusinessDetailsInput } from "@/app/[locale]/dashboard/settings/banking/schemas";
import type { CategoryPickerLeaf } from "@/lib/taxonomy/CategoryPicker";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

import { togglePublishAction } from "../properties/[id]/edit/actions";
import type { PolicyCard } from "../policies/PolicyManager";
import type { PolicyType } from "../policies/schemas";
import type {
  ListingGroup,
  SeasonalRule,
} from "../seasonal-pricing/SeasonalPricingManager";
import { SetupPreview } from "./SetupPreview";
import { StepBanking } from "./steps/StepBanking";
import { StepBusiness } from "./steps/StepBusiness";
import { StepListing } from "./steps/StepListing";
import { StepRooms } from "./steps/StepRooms";
import { StepSeasonal } from "./steps/StepSeasonal";
import { StepPolicies } from "./steps/StepPolicies";
import { StepProfile } from "./steps/StepProfile";
import type {
  Host,
  Listing,
  Photo,
  Profile,
  Room,
  SetupStepKey,
} from "./types";

type SectionMeta = {
  key: SetupStepKey;
  n: number;
  label: string;
  rail: string;
  required: boolean;
  icon: LucideIcon;
  help: string;
};

// One focused goal per step, in order. "review" is the final action step.
const SECTIONS: SectionMeta[] = [
  {
    key: "profile",
    n: 1,
    label: "Host profile",
    rail: "Profile",
    required: true,
    icon: UserRound,
    help: "Tell guests who they're booking with — a photo and a few honest words go a long way.",
  },
  {
    key: "business",
    n: 2,
    label: "Business name & details",
    rail: "Business",
    required: true,
    icon: Building2,
    help: "Your business name and details — shown on invoices, quotes and EFT payment instructions.",
  },
  {
    key: "banking",
    n: 3,
    label: "Payment method",
    rail: "Payment",
    required: true,
    icon: CreditCard,
    help: "The bank account where your payouts land, also used on EFT instructions for guests.",
  },
  {
    key: "listing",
    n: 4,
    label: "Listing details",
    rail: "Listing",
    required: true,
    icon: HomeIcon,
    help: "Photos, the essentials, and the amenities that make your place special.",
  },
  {
    key: "rooms",
    n: 5,
    label: "Rooms & pricing",
    rail: "Rooms",
    required: true,
    icon: BedDouble,
    help: "Set up the rooms guests can book and their nightly pricing.",
  },
  {
    key: "seasonal",
    n: 6,
    label: "Seasonal pricing",
    rail: "Seasons",
    required: false,
    icon: CalendarRange,
    help: "Optional — charge more in peak season and less when it's quiet. Applied automatically when guests book those dates.",
  },
  {
    key: "policies",
    n: 7,
    label: "Policies & house rules",
    rail: "Policies",
    required: true,
    icon: ShieldCheck,
    help: "Check-in times, a minimum stay, and your cancellation policy.",
  },
  {
    key: "review",
    n: 8,
    label: "Preview & publish",
    rail: "Publish",
    required: false,
    icon: Rocket,
    help: "This is exactly what guests will see. Happy with it? Publish to go live.",
  },
];

type Props = {
  requestedStep: string | null;
  host: Host;
  profile: Profile;
  emailVerified: boolean;
  listing: Listing;
  bankAccounts: Account[];
  businessDefaults: BusinessDetailsInput;
  businessNameSet: boolean;
  businessAddressSet: boolean;
  photos: Photo[];
  rooms: Room[];
  categoryLeaves: CategoryPickerLeaf[];
  amenityGroups: AmenityGroupWithItems[];
  amenities: { id: string; key: string; roomId: string | null }[];
  policies: PolicyCard[];
  policyAssignments: Partial<Record<PolicyType, string | null>>;
  /** All four host policies resolve for this listing (resolver-based, honors
      host defaults) — the SAME check the publish gate uses. */
  policiesComplete: boolean;
  seasonalListing: ListingGroup;
  seasonalRules: SeasonalRule[];
};

export function SetupWizard(props: Props) {
  const router = useRouter();

  const [host, setHost] = useState(props.host);
  const [profile, setProfile] = useState(props.profile);
  const [listing, setListing] = useState(props.listing);
  const [photos, setPhotos] = useState(props.photos);
  const [amenities, setAmenities] = useState(props.amenities);

  const bankAccounts = props.bankAccounts;
  const businessDefaults = props.businessDefaults;
  const rooms = props.rooms;
  const policies = props.policies;
  const policyAssignments = props.policyAssignments;

  const [published, setPublished] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [publishing, startPublish] = useTransition();

  // Route every step's post-save refresh through a transition so a full-screen
  // "Saving…" overlay stays up until the refreshed UI actually commits — no
  // more "did it work?" dead time after a save.
  const [refreshing, startRefresh] = useTransition();
  const [busyLabel, setBusyLabel] = useState("Saving…");
  function refreshWith(label: string) {
    setBusyLabel(label);
    startRefresh(() => router.refresh());
  }

  const done = useMemo(
    () =>
      computeSetupCompletion({
        host,
        businessNameSet: props.businessNameSet,
        businessAddressSet: props.businessAddressSet,
        hasBankAccount: bankAccounts.length > 0,
        listing,
        photoCount: photos.length,
        roomCount: rooms.filter((r) => r.is_active).length,
        // All four host policies must resolve — the SAME check the publish gate
        // uses, computed server-side and refreshed after each policy edit.
        policiesComplete: props.policiesComplete,
        hasSeasonalRules: props.seasonalRules.length > 0,
      }),
    [
      host,
      props.businessNameSet,
      props.businessAddressSet,
      bankAccounts,
      listing,
      photos,
      rooms,
      props.policiesComplete,
      props.seasonalRules,
    ],
  );

  const requiredSections = SECTIONS.filter((s) => s.required);
  const doneCount = requiredSections.filter((s) => done[s.key]).length;
  const pct = Math.round((doneCount / requiredSections.length) * 100);
  const missing = requiredSections.filter((s) => !done[s.key]);
  const ready = missing.length === 0;

  // First incomplete required step (or the final review step).
  const firstIncomplete = Math.max(
    0,
    SECTIONS.findIndex((s) => s.required && !done[s.key]),
  );
  const startIndex = ready ? SECTIONS.length - 1 : firstIncomplete;

  const [current, setCurrent] = useState(startIndex);
  const [maxReached, setMaxReached] = useState(startIndex);
  const cur = SECTIONS[current];
  const isReview = cur.key === "review";

  function goTo(i: number) {
    if (i < 0 || i >= SECTIONS.length || i > maxReached) return;
    setCurrent(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function next() {
    const ni = Math.min(current + 1, SECTIONS.length - 1);
    setCurrent(ni);
    setMaxReached((m) => Math.max(m, ni));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setCurrent((c) => Math.max(0, c - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Honour ?step= deep links once on mount.
  const didJump = useRef(false);
  useEffect(() => {
    if (didJump.current || !props.requestedStep) return;
    didJump.current = true;
    const idx = SECTIONS.findIndex((s) => s.key === props.requestedStep);
    if (idx >= 0) {
      setCurrent(idx);
      setMaxReached((m) => Math.max(m, idx));
    }
  }, [props.requestedStep]);

  function publish() {
    if (!ready) {
      toast.error("Finish the required steps first.");
      const i = SECTIONS.findIndex((s) => s.key === missing[0].key);
      if (i >= 0) {
        setCurrent(i);
        setMaxReached((m) => Math.max(m, i));
      }
      return;
    }
    startPublish(async () => {
      const result = await togglePublishAction(listing.id, true);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setListing((l) => ({ ...l, is_published: true }));
      setShowConfetti(true);
      setPublished(true);
      setTimeout(() => setShowConfetti(false), 5200);
    });
  }

  const coverUrl = photos[0]?.url ?? host.avatar_url ?? null;
  const remaining = requiredSections.length - doneCount;

  return (
    <div className="space-y-5">
      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[11px] border border-brand-line bg-brand-light">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-mute">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/dashboard" className="hover:text-brand-ink">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">Finish setup</span>
          </nav>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h1 className="truncate font-display text-[19px] font-extrabold leading-none text-brand-ink">
              {listing.name || "Your listing"}
            </h1>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${
                listing.is_published
                  ? "border-brand-primary/30 bg-brand-accent text-brand-secondary"
                  : "border-brand-line bg-brand-light text-brand-mute"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  listing.is_published ? "bg-brand-primary" : "bg-brand-mute"
                }`}
              />
              {listing.is_published ? "Live" : "Draft"}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="mr-1 hidden items-center gap-1.5 text-[12px] md:inline-flex">
            {ready ? (
              <span className="inline-flex items-center gap-1.5 text-brand-secondary">
                <Check className="h-3.5 w-3.5 text-brand-primary" /> Ready to
                publish
              </span>
            ) : (
              <span className="tabular-nums text-brand-mute">
                {doneCount}/{requiredSections.length} required steps done
              </span>
            )}
          </span>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-brand-mute" /> Exit
          </Link>
        </div>
      </div>

      {/* ============ SPLIT: step rail + active panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[288px_1fr]">
        {/* ─── Left rail: progress ring + clickable steps ─── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {/* progress summary */}
          <div className="mb-3 flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card">
            <ProgressRing pct={pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {ready ? "Ready to publish" : "Almost ready"}
              </div>
              <div className="text-[11px] text-brand-mute">
                {ready
                  ? "Publish to go live"
                  : `${remaining} step${remaining === 1 ? "" : "s"} left`}
              </div>
            </div>
          </div>

          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Steps
          </div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((s, i) => {
              const reachable = i <= maxReached;
              const isCurrent = i === current;
              const isDone = done[s.key] && s.key !== "review";
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={!reachable}
                  aria-current={isCurrent ? "page" : undefined}
                  title={s.label}
                  className={`flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                    isCurrent
                      ? "border-brand-line bg-white shadow-card"
                      : reachable
                        ? "border-transparent hover:bg-white"
                        : "cursor-not-allowed border-transparent opacity-45"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
                      isDone || isCurrent
                        ? "bg-brand-primary text-white"
                        : "bg-brand-accent/70 text-brand-secondary"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-[18px] w-[18px]" strokeWidth={3} />
                    ) : (
                      <Icon className="h-[18px] w-[18px]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] font-semibold leading-tight ${
                        isCurrent ? "text-brand-ink" : "text-brand-ink/80"
                      }`}
                    >
                      {s.rail}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                      {isDone ? "Done" : s.required ? "Required" : "Optional"}
                    </span>
                  </span>
                  {isDone ? (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : s.required && reachable ? (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending"
                      title="Required"
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ─── Content column ─── */}
        <div className="min-w-0">
          {/* panel header */}
          <div className="mb-5 flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
              <cur.icon className="h-[22px] w-[22px]" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-brand-ink">
                  {cur.label}
                </h2>
                <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-secondary">
                  {cur.key === "review"
                    ? "Final"
                    : cur.required
                      ? "Required"
                      : "Optional"}
                </span>
              </div>
              <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-brand-mute">
                {cur.help}
              </p>
            </div>
          </div>

          {/* step body */}
          {isReview ? (
            <SetupPreview
              host={host}
              profile={profile}
              listing={listing}
              photos={photos}
              rooms={rooms}
              ready={ready}
              missing={missing.map((m) => ({ key: m.key, label: m.label }))}
              onJump={(key) => {
                const i = SECTIONS.findIndex((s) => s.key === key);
                if (i >= 0) {
                  setCurrent(i);
                  setMaxReached((m) => Math.max(m, i));
                }
              }}
            />
          ) : (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="p-6 md:p-7">
                {cur.key === "profile" ? (
                  <StepProfile
                    host={host}
                    profile={profile}
                    emailVerified={props.emailVerified}
                    onSaved={(nextVal) => {
                      setHost((h) => ({ ...h, ...nextVal.host }));
                      setProfile((p) => ({ ...p, ...nextVal.profile }));
                      next();
                    }}
                  />
                ) : null}
                {cur.key === "business" ? (
                  <StepBusiness
                    businessDefaults={businessDefaults}
                    nameSet={props.businessNameSet}
                    addressSet={props.businessAddressSet}
                    onChanged={() => refreshWith("Saving your business…")}
                    onContinue={next}
                  />
                ) : null}
                {cur.key === "banking" ? (
                  <StepBanking
                    accounts={bankAccounts}
                    onChanged={() => refreshWith("Saving your payment method…")}
                    onContinue={next}
                  />
                ) : null}
                {cur.key === "listing" ? (
                  <StepListing
                    listing={listing}
                    photos={photos}
                    categoryLeaves={props.categoryLeaves}
                    amenityGroups={props.amenityGroups}
                    amenities={amenities}
                    onListingChanged={(patch) =>
                      setListing((l) => ({ ...l, ...patch }))
                    }
                    onPhotosChanged={(nextVal) => setPhotos(nextVal)}
                    onAmenitiesChanged={(nextVal) => setAmenities(nextVal)}
                    onContinue={next}
                  />
                ) : null}
                {cur.key === "rooms" ? (
                  <StepRooms
                    listingId={listing.id}
                    rooms={rooms}
                    onChanged={() => refreshWith("Saving your room…")}
                    onContinue={next}
                  />
                ) : null}
                {cur.key === "seasonal" ? (
                  <StepSeasonal
                    listing={props.seasonalListing}
                    rules={props.seasonalRules}
                    onContinue={next}
                  />
                ) : null}
                {cur.key === "policies" ? (
                  <StepPolicies
                    listing={listing}
                    policies={policies}
                    assignments={policyAssignments}
                    policiesComplete={props.policiesComplete}
                    onChanged={() => refreshWith("Saving your policy…")}
                    onContinue={next}
                  />
                ) : null}
              </div>
            </section>
          )}

          {/* footer nav — global Back (each step owns its own forward
          "Continue"/"Save & continue" button); the review step adds Publish. */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-brand-line pt-5">
            {current > 0 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
              >
                <ArrowLeft className="h-4 w-4" /> {SECTIONS[current - 1].rail}
              </button>
            ) : (
              <span />
            )}
            <span className="text-[12px] font-medium tabular-nums text-brand-mute">
              {current + 1} / {SECTIONS.length}
            </span>
            {isReview ? (
              <button
                type="button"
                onClick={publish}
                disabled={publishing}
                className={`inline-flex h-10 items-center gap-1.5 rounded-pill px-5 text-[13px] font-semibold text-white transition ${
                  ready
                    ? "bg-brand-primary shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] hover:bg-brand-secondary"
                    : "cursor-not-allowed bg-brand-mute/60"
                }`}
              >
                <Rocket className="h-4 w-4" />
                {publishing
                  ? "Publishing…"
                  : ready
                    ? "Publish listing"
                    : "Finish required steps"}
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      <BusyOverlay show={refreshing} label={busyLabel} />
      {showConfetti ? <Confetti /> : null}
      {published ? (
        <PublishedModal
          listing={listing}
          onClose={() => {
            setPublished(false);
            router.push("/dashboard");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// Progress donut — shared visual language with the Add-ons / Specials editors.
function ProgressRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#E4EFE8"
          strokeWidth="3.4"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[11.5px] font-bold tabular-nums text-brand-ink">
        {pct}%
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => {
    const colors = [
      "#10B981",
      "#064E3B",
      "#D1FAE5",
      "#34D399",
      "#A7F3D0",
      "#F4A836",
    ];
    return Array.from({ length: 70 }).map((_, i) => ({
      left: (i * 37) % 100,
      dx: `${((i * 53) % 220) - 110}px`,
      d: `${3 + ((i * 7) % 25) / 10}s`,
      delay: `${((i * 13) % 80) / 100}s`,
      bg: colors[i % colors.length],
      rot: (i * 47) % 180,
    }));
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="setup-confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.bg,
              transform: `rotate(${p.rot}deg)`,
              "--dx": p.dx,
              "--d": p.d,
              "--delay": p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function PublishedModal({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  const slug = listing.slug;
  const path = slug ? `/property/${slug}` : null;
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const displayUrl = path ? `${origin}${path}`.replace(/^https?:\/\//, "") : "";
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!path) return;
    navigator.clipboard?.writeText(`${origin}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card bg-white p-7 text-center shadow-peek"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold text-brand-ink">
          You&rsquo;re live! 🎉
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-brand-mute">
          <span className="font-semibold text-brand-ink">{listing.name}</span>{" "}
          is now published and bookable. Here&rsquo;s your live page — share it
          to start taking direct bookings.
        </p>

        {path ? (
          <button
            type="button"
            onClick={copy}
            title="Click to copy"
            className="mt-4 flex w-full items-center gap-2 rounded border border-brand-line bg-brand-light/60 px-3 py-2.5 text-left font-mono text-xs text-brand-ink transition hover:border-brand-primary/50"
          >
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
            <span className="flex-1 truncate">{displayUrl || path}</span>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </span>
          </button>
          {path ? (
            <a
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              <ExternalLink className="h-4 w-4" /> View listing
            </a>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
