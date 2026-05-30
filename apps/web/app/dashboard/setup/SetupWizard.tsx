"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  LayoutDashboard,
  Link as LinkIcon,
  PartyPopper,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { computeSetupCompletion } from "@/lib/setup/completion";

import type { Account } from "@/app/dashboard/settings/banking/_components/BankAccountList";
import type { BusinessDetailsInput } from "@/app/dashboard/settings/banking/schemas";
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
  n: string;
  label: string;
  rail: string;
  required: boolean;
};

// Section order for the single-scroll layout + left rail. "review" is the
// final action step (the live preview + publish), never a "required" item.
const SECTIONS: SectionMeta[] = [
  {
    key: "profile",
    n: "1",
    label: "Host profile",
    rail: "Profile",
    required: true,
  },
  {
    key: "banking",
    n: "2",
    label: "Business info",
    rail: "Business",
    required: true,
  },
  {
    key: "listing",
    n: "3",
    label: "Listing details",
    rail: "Listing",
    required: true,
  },
  {
    key: "rooms",
    n: "4",
    label: "Rooms & pricing",
    rail: "Rooms",
    required: true,
  },
  {
    key: "policies",
    n: "5",
    label: "Policies & house rules",
    rail: "Policies",
    required: true,
  },
  {
    key: "review",
    n: "6",
    label: "Preview & publish",
    rail: "Preview",
    required: false,
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
  policyAssignments: Record<PolicyType, string | null>;
};

export function SetupWizard(props: Props) {
  const router = useRouter();

  // Live draft state — steps mutate these on save so the rail + ring + preview
  // all update without a server refetch.
  const [host, setHost] = useState(props.host);
  const [profile, setProfile] = useState(props.profile);
  const [listing, setListing] = useState(props.listing);
  const [photos, setPhotos] = useState(props.photos);

  // Banking, business AND rooms are managed by shared canonical components via
  // server actions; they call onChanged → router.refresh, which re-runs the
  // server page and feeds fresh props here. Read straight from props so the
  // rail / completion / cards update after a refresh.
  const bankAccounts = props.bankAccounts;
  const businessDefaults = props.businessDefaults;
  const rooms = props.rooms;
  const policies = props.policies;
  const policyAssignments = props.policyAssignments;

  const [active, setActive] = useState<SetupStepKey>("profile");
  const [published, setPublished] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [publishing, startPublish] = useTransition();

  // Completion is the single shared predicate, computed from live state.
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

  function jump(key: SetupStepKey) {
    document
      .getElementById(`sec-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target as HTMLElement | undefined;
        if (top?.dataset.section)
          setActive(top.dataset.section as SetupStepKey);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`sec-${s.key}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  // Honour ?step= deep links by scrolling there on mount.
  const didJump = useRef(false);
  useEffect(() => {
    if (didJump.current || !props.requestedStep) return;
    didJump.current = true;
    const t = setTimeout(() => jump(props.requestedStep as SetupStepKey), 250);
    return () => clearTimeout(t);
  }, [props.requestedStep]);

  function publish() {
    if (!ready) {
      toast.error("Finish the required steps first.");
      jump(missing[0].key);
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

  const firstName = (profile.full_name || host.display_name || "there").split(
    " ",
  )[0];

  return (
    <div className="py-2">
      {/* Dark hero */}
      <Hero
        firstName={firstName}
        active={active}
        done={done}
        pct={pct}
        doneCount={doneCount}
        total={requiredSections.length}
        ready={ready}
        publishing={publishing}
        onJump={jump}
        onPublish={publish}
      />

      {/* Rail + stacked section cards */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-3">
          <ProgressRail
            active={active}
            done={done}
            pct={pct}
            ready={ready}
            publishing={publishing}
            onJump={jump}
            onPublish={publish}
          />
        </div>

        <div className="col-span-12 space-y-5 lg:col-span-9">
          <SectionCard
            meta={SECTIONS[0]}
            complete={done.profile}
            active={active === "profile"}
          >
            <StepProfile
              host={host}
              profile={profile}
              emailVerified={props.emailVerified}
              onSaved={(next) => {
                setHost((h) => ({ ...h, ...next.host }));
                setProfile((p) => ({ ...p, ...next.profile }));
                jump("banking");
              }}
            />
          </SectionCard>

          <SectionCard
            meta={SECTIONS[1]}
            complete={done.banking}
            active={active === "banking"}
          >
            <StepBanking
              accounts={bankAccounts}
              businessDefaults={businessDefaults}
              onChanged={() => router.refresh()}
              onContinue={() => jump("listing")}
            />
          </SectionCard>

          <SectionCard
            meta={SECTIONS[2]}
            complete={done.listing}
            active={active === "listing"}
          >
            <StepListing
              listing={listing}
              photos={photos}
              categoryLeaves={props.categoryLeaves}
              amenityGroups={props.amenityGroups}
              amenities={props.amenities}
              onListingChanged={(patch) =>
                setListing((l) => ({ ...l, ...patch }))
              }
              onPhotosChanged={(next) => setPhotos(next)}
              onContinue={() => jump("rooms")}
            />
          </SectionCard>

          <SectionCard
            meta={SECTIONS[3]}
            complete={done.rooms}
            active={active === "rooms"}
          >
            <StepRooms
              listingId={listing.id}
              rooms={rooms}
              onChanged={() => router.refresh()}
              onContinue={() => jump("policies")}
            />
          </SectionCard>

          <SectionCard
            meta={SECTIONS[4]}
            complete={done.policies}
            active={active === "policies"}
          >
            <StepPolicies
              listing={listing}
              policies={policies}
              assignments={policyAssignments}
              onChanged={() => router.refresh()}
              onContinue={() => jump("review")}
            />
          </SectionCard>

          <SectionCard
            meta={SECTIONS[5]}
            complete={published}
            active={active === "review"}
          >
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
              onJump={jump}
            />
          </SectionCard>
        </div>
      </div>

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

function Hero({
  firstName,
  active,
  done,
  pct,
  doneCount,
  total,
  ready,
  publishing,
  onJump,
  onPublish,
}: {
  firstName: string;
  active: SetupStepKey;
  done: Record<SetupStepKey, boolean>;
  pct: number;
  doneCount: number;
  total: number;
  ready: boolean;
  publishing: boolean;
  onJump: (key: SetupStepKey) => void;
  onPublish: () => void;
}) {
  const dash = (pct / 100) * 97.4;
  return (
    <section className="relative overflow-hidden rounded-card border border-brand-line shadow-card">
      <div className="relative bg-brand-gradient-dark p-6 text-white md:p-8">
        <div
          aria-hidden
          className="setup-dotgrid pointer-events-none absolute inset-0 opacity-30"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl"
        />

        <div className="relative">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent/80 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>

          <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                Finish setting up
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-brand-accent/80">
                A few more details, {firstName}, and you&rsquo;re ready to take
                real bookings. Each step saves as you go — required steps unlock
                Publish.
              </p>
            </div>

            {/* Right cluster: count ring + publish */}
            <div className="flex shrink-0 items-center gap-4">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} 97.4`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="num font-display text-base font-bold text-white">
                    {doneCount}
                    <span className="text-xs text-white/60">/{total}</span>
                  </span>
                  <span className="mt-0.5 text-[8.5px] uppercase tracking-wider text-brand-accent/70">
                    done
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onPublish}
                disabled={!ready || publishing}
                className={`inline-flex items-center gap-2 rounded-card px-4 py-3 text-sm font-semibold shadow-card transition-all ${
                  ready
                    ? "bg-brand-primary text-white hover:bg-white hover:text-brand-secondary"
                    : "cursor-not-allowed bg-white/10 text-white/50"
                }`}
              >
                <Rocket className="h-4 w-4" />
                {publishing
                  ? "Publishing…"
                  : ready
                    ? "Publish listing"
                    : "Finish to publish"}
              </button>
            </div>
          </div>

          {/* Horizontal step chips */}
          <ol className="mt-6 flex flex-wrap gap-2">
            {SECTIONS.map((s) => {
              const isDone = done[s.key];
              const isActive = active === s.key;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onJump(s.key)}
                    aria-current={isActive ? "step" : undefined}
                    className={`flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      isDone
                        ? "border-brand-primary bg-brand-primary text-white"
                        : isActive
                          ? "border-brand-primary bg-white/10 text-white"
                          : "border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className={`num flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isDone
                          ? "bg-white/20 text-white"
                          : isActive
                            ? "bg-brand-primary text-white"
                            : "bg-white/10 text-white/70"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        s.n
                      )}
                    </span>
                    {s.rail}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ProgressRail({
  active,
  done,
  pct,
  ready,
  publishing,
  onJump,
  onPublish,
}: {
  active: SetupStepKey;
  done: Record<SetupStepKey, boolean>;
  pct: number;
  ready: boolean;
  publishing: boolean;
  onJump: (key: SetupStepKey) => void;
  onPublish: () => void;
}) {
  return (
    <div className="sticky top-24 space-y-4">
      <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Setup progress
          </span>
          <span className="num font-display text-sm font-bold text-brand-primary">
            {pct}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-pill bg-brand-light">
          <div
            className="h-full rounded-pill bg-brand-gradient transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <nav className="mt-4 space-y-0.5">
          {SECTIONS.map((s) => {
            const isDone = done[s.key];
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onJump(s.key)}
                className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                  isActive ? "bg-brand-accent" : "hover:bg-brand-light"
                }`}
              >
                <span
                  className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                    isDone
                      ? "border-brand-primary bg-brand-primary text-white"
                      : isActive
                        ? "border-brand-primary bg-white text-brand-primary"
                        : "border-brand-line bg-white text-brand-mute"
                  }`}
                >
                  {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : s.n}
                </span>
                <span
                  className={`flex-1 truncate text-[13px] font-medium ${
                    isActive
                      ? "text-brand-ink"
                      : "text-brand-mute group-hover:text-brand-ink"
                  }`}
                >
                  {s.rail}
                </span>
                {s.required && !isDone ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending"
                    title="Required"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={onPublish}
        disabled={!ready || publishing}
        className={`flex w-full items-center justify-center gap-2 rounded-card px-4 py-3 text-sm font-semibold shadow-card transition-all ${
          ready
            ? "bg-brand-primary text-white hover:bg-brand-secondary hover:shadow-glow"
            : "cursor-not-allowed bg-brand-line text-brand-mute"
        }`}
      >
        <Rocket className="h-4 w-4" />
        {publishing
          ? "Publishing…"
          : ready
            ? "Publish listing"
            : "Finish required steps"}
      </button>
      {!ready ? (
        <p className="px-1 text-center text-[11px] leading-relaxed text-brand-mute">
          Complete the required steps to go live. You can keep editing after
          publishing.
        </p>
      ) : null}
    </div>
  );
}

function SectionCard({
  meta,
  complete,
  active,
  children,
}: {
  meta: SectionMeta;
  complete: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`sec-${meta.key}`}
      data-section={meta.key}
      className={`scroll-mt-24 rounded-card border bg-white shadow-card transition-colors ${
        active
          ? "setup-step-active border-brand-primary/40"
          : "border-brand-line"
      }`}
    >
      <div className="flex items-start gap-4 border-b border-brand-line px-6 py-5 md:px-7">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card font-display text-sm font-bold transition-colors ${
            complete
              ? "bg-brand-primary text-white"
              : "bg-brand-accent text-brand-secondary"
          }`}
        >
          {complete ? <Check className="h-5 w-5" strokeWidth={3} /> : meta.n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-brand-ink">
              {meta.label}
            </h2>
            <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
              {meta.required ? "Required" : "Final step"}
            </span>
            {complete ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Done
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-6 py-6 md:px-7">{children}</div>
    </section>
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
  // The real, resolvable public URL is /listing/<slug> (slug is set on the
  // listing row — never re-derive it from the name, which can diverge).
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
