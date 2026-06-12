"use client";

import {
  ArrowLeft,
  BedDouble,
  Check,
  CreditCard,
  ExternalLink,
  Home as HomeIcon,
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

import { togglePublishAction } from "../listings/[id]/edit/actions";
import type { PolicyCard } from "../policies/PolicyManager";
import type { PolicyType } from "../policies/schemas";
import { SetupPreview } from "./SetupPreview";
import { StepBanking } from "./steps/StepBanking";
import { StepListing } from "./steps/StepListing";
import { StepRooms } from "./steps/StepRooms";
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
    key: "banking",
    n: 2,
    label: "Business & payouts",
    rail: "Business",
    required: true,
    icon: CreditCard,
    help: "Your business details and where your payouts land.",
  },
  {
    key: "listing",
    n: 3,
    label: "Listing details",
    rail: "Listing",
    required: true,
    icon: HomeIcon,
    help: "Photos, the essentials, and the amenities that make your place special.",
  },
  {
    key: "rooms",
    n: 4,
    label: "Rooms & pricing",
    rail: "Rooms",
    required: true,
    icon: BedDouble,
    help: "Set up the rooms guests can book and their nightly pricing.",
  },
  {
    key: "policies",
    n: 5,
    label: "Policies & house rules",
    rail: "Policies",
    required: true,
    icon: ShieldCheck,
    help: "Check-in times, a minimum stay, and your cancellation policy.",
  },
  {
    key: "review",
    n: 6,
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
  photos: Photo[];
  rooms: Room[];
  categoryLeaves: CategoryPickerLeaf[];
  amenityGroups: AmenityGroupWithItems[];
  amenities: { id: string; key: string; roomId: string | null }[];
  policies: PolicyCard[];
  policyAssignments: Partial<Record<PolicyType, string | null>>;
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
        hasBankAccount: bankAccounts.length > 0,
        listing,
        photoCount: photos.length,
        roomCount: rooms.filter((r) => r.is_active).length,
        hasCancellationPolicy: policyAssignments.cancellation != null,
      }),
    [host, bankAccounts, listing, photos, rooms, policyAssignments],
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

  const containerMax = isReview ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className={`mx-auto ${containerMax}`}>
      {/* stepper bar */}
      <div className="mb-6 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-brand-mute" /> Exit
          </Link>
          <div className="mx-auto hidden items-center gap-1 md:flex">
            {SECTIONS.map((s, i) => {
              const reachable = i <= maxReached;
              const isCurrent = i === current;
              const isDone = done[s.key] && !isCurrent && s.key !== "review";
              return (
                <div key={s.key} className="flex items-center gap-1">
                  {i > 0 ? (
                    <span
                      className={`h-px w-5 ${i <= maxReached ? "bg-brand-primary/40" : "bg-brand-line"}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={!reachable}
                    title={s.label}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-colors ${
                      isCurrent
                        ? "border-brand-primary bg-brand-primary text-white"
                        : isDone
                          ? "border-brand-primary/40 bg-brand-accent text-brand-secondary hover:bg-brand-accent/70"
                          : "border-brand-line bg-white text-brand-mute"
                    } ${!reachable ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      s.n
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <span className="ml-auto text-[12.5px] font-medium tabular-nums text-brand-mute">
            Step {current + 1} of {SECTIONS.length}
          </span>
        </div>
        <div className="h-1 w-full bg-brand-line">
          <div
            className="h-full bg-brand-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* step heading */}
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 text-[11px] font-semibold text-brand-secondary">
          <cur.icon className="h-3.5 w-3.5" />{" "}
          {cur.required ? "Required" : "Final"} step
        </span>
        <h1 className="mt-3 font-display text-[26px] font-extrabold leading-tight tracking-tight text-brand-ink md:text-[28px]">
          {cur.label}
        </h1>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-brand-mute">
          {cur.help}
        </p>
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
          publishing={publishing}
          missing={missing.map((m) => ({ key: m.key, label: m.label }))}
          onPublish={publish}
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
            {cur.key === "banking" ? (
              <StepBanking
                accounts={bankAccounts}
                businessDefaults={businessDefaults}
                onChanged={() => refreshWith("Saving your details…")}
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
            {cur.key === "policies" ? (
              <StepPolicies
                listing={listing}
                policies={policies}
                assignments={policyAssignments}
                onChanged={() => refreshWith("Saving your policy…")}
                onContinue={next}
              />
            ) : null}
          </div>
        </section>
      )}

      {/* footer nav — a single global Back (each step owns its own forward
          "Continue"/"Save & continue" button); the review step adds Publish. */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          disabled={current === 0}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {isReview ? (
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-pill px-5 py-2.5 text-[14px] font-semibold text-white transition ${
              ready
                ? "bg-brand-primary shadow-[0_10px_24px_-10px_rgba(16,185,129,.7)] hover:bg-brand-secondary"
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
        ) : null}
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
  const path = slug ? `/listing/${slug}` : null;
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
