"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { computeSetupCompletion } from "@/lib/setup/completion";

import { StepBanking } from "./steps/StepBanking";
import { StepListing } from "./steps/StepListing";
import { StepPolicies } from "./steps/StepPolicies";
import { StepProfile } from "./steps/StepProfile";
import { StepReview } from "./steps/StepReview";
import type {
  BankAccount,
  BusinessDetails,
  Host,
  Listing,
  Photo,
  Profile,
  Room,
  SetupStepKey,
} from "./types";

const STEPS: { key: SetupStepKey; label: string; description: string }[] = [
  {
    key: "profile",
    label: "Your profile",
    description: "Photo, bio, languages — what guests see first.",
  },
  {
    key: "banking",
    label: "Banking",
    description: "How we route guest payments to you.",
  },
  {
    key: "listing",
    label: "Listing details",
    description: "Photos, pricing and rooms for your first listing.",
  },
  {
    key: "policies",
    label: "Policies",
    description: "Cancellation, check-in / out times, house rules.",
  },
  {
    key: "review",
    label: "Review & publish",
    description: "One last look, then you're live.",
  },
];

type Props = {
  requestedStep: string | null;
  host: Host;
  profile: Profile;
  emailVerified: boolean;
  listing: Listing;
  bankAccounts: BankAccount[];
  businessDetails: BusinessDetails | null;
  photos: Photo[];
  rooms: Room[];
};

export function SetupWizard(props: Props) {
  // Compute which steps are already complete from the data we received.
  // The wizard auto-jumps to the first incomplete step unless ?step= asks
  // for a specific one.
  const initialDone = computeInitialDone(props);
  const initialIndex = pickInitialIndex(props.requestedStep, initialDone);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // Local completion state so steps can mark themselves done after a save
  // without a full server refetch.
  const [done, setDone] = useState(initialDone);

  // The data props are server-fetched snapshots — once a step saves, we
  // mutate this local copy so subsequent steps see the latest values.
  // Server actions also revalidate, so a refresh would refetch anyway.
  const [host, setHost] = useState(props.host);
  const [profile, setProfile] = useState(props.profile);
  const [listing, setListing] = useState(props.listing);
  const [bankAccounts, setBankAccounts] = useState(props.bankAccounts);
  const [businessDetails, setBusinessDetails] = useState(props.businessDetails);
  const [photos, setPhotos] = useState(props.photos);
  const [rooms, setRooms] = useState(props.rooms);

  const current = STEPS[currentIndex];
  const doneCount = STEPS.filter((s) => done[s.key]).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  function markDone(key: SetupStepKey) {
    setDone((d) => ({ ...d, [key]: true }));
  }

  function goTo(idx: number) {
    if (idx < 0 || idx >= STEPS.length) return;
    setCurrentIndex(idx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function advance() {
    markDone(current.key);
    if (currentIndex < STEPS.length - 1) goTo(currentIndex + 1);
  }

  return (
    <div className="py-2">
      {/* Dark hero with progress ring + step chips */}
      <section className="relative mb-6 overflow-hidden rounded-card border border-brand-line shadow-card">
        <div className="relative bg-brand-gradient-dark p-6 text-white md:p-8">
          <div
            aria-hidden
            className="setup-dotgrid pointer-events-none absolute inset-0 opacity-30"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl"
          />

          <div className="relative flex items-start justify-between gap-6">
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent/80 transition hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
              </Link>
              <h1 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
                Finish setting up
              </h1>
              <p className="mt-1 max-w-xl text-sm text-brand-accent/80">
                A few more details and you&rsquo;re ready to take real bookings.
                Each step saves as you go.
              </p>
            </div>
            <ProgressRing
              pct={pct}
              doneCount={doneCount}
              total={STEPS.length}
            />
          </div>

          {/* Step chips */}
          <ol className="relative mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {STEPS.map((s, idx) => {
              const isDone = done[s.key];
              const isCurrent = idx === currentIndex;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => goTo(idx)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition ${
                      isCurrent
                        ? "border-brand-primary bg-white/10"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/10"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-[11px] font-bold ${
                        isDone
                          ? "bg-brand-primary text-white"
                          : isCurrent
                            ? "border-2 border-brand-primary bg-brand-primary/20 text-white"
                            : "border border-white/25 text-white/60"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`truncate text-[12px] font-semibold ${
                          isCurrent || isDone ? "text-white" : "text-white/70"
                        }`}
                      >
                        {s.label}
                      </div>
                      <div
                        className={`truncate text-[10px] ${
                          isDone
                            ? "text-brand-primary"
                            : isCurrent
                              ? "text-brand-accent/80"
                              : "text-white/40"
                        }`}
                      >
                        {isDone ? "Done" : isCurrent ? "In progress" : "To do"}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Current step body */}
      <div className="setup-step-active rounded-card border border-brand-line bg-white p-6 shadow-card md:p-8">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Step {currentIndex + 1} of {STEPS.length}
          </div>
          <h2 className="mt-1 font-display text-xl font-bold text-brand-ink md:text-2xl">
            {current.label}
          </h2>
          <p className="mt-1 text-sm text-brand-mute">{current.description}</p>
        </div>

        {current.key === "profile" ? (
          <StepProfile
            host={host}
            profile={profile}
            emailVerified={props.emailVerified}
            onSaved={(next) => {
              setHost((h) => ({ ...h, ...next.host }));
              setProfile((p) => ({ ...p, ...next.profile }));
              advance();
            }}
          />
        ) : null}

        {current.key === "banking" ? (
          <StepBanking
            hostId={host.id}
            bankAccounts={bankAccounts}
            businessDetails={businessDetails}
            onAccountSaved={(acc) => setBankAccounts((list) => [...list, acc])}
            onAccountUpdated={(id, patch) =>
              setBankAccounts((list) =>
                list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
              )
            }
            onAccountDeleted={(id) =>
              setBankAccounts((list) => list.filter((a) => a.id !== id))
            }
            onDefaultChanged={(id) =>
              setBankAccounts((list) =>
                list.map((a) => ({ ...a, is_default: a.id === id })),
              )
            }
            onBusinessSaved={(b) => setBusinessDetails(b)}
            onContinue={advance}
          />
        ) : null}

        {current.key === "listing" ? (
          <StepListing
            listing={listing}
            photos={photos}
            rooms={rooms}
            onListingChanged={(patch) =>
              setListing((l) => ({ ...l, ...patch }))
            }
            onPhotoAdded={(p) => setPhotos((list) => [...list, p])}
            onPhotoRemoved={(id) =>
              setPhotos((list) => list.filter((p) => p.id !== id))
            }
            onRoomSaved={(r) =>
              setRooms((list) => {
                const idx = list.findIndex((x) => x.id === r.id);
                if (idx === -1) return [...list, r];
                const next = [...list];
                next[idx] = r;
                return next;
              })
            }
            onContinue={advance}
          />
        ) : null}

        {current.key === "policies" ? (
          <StepPolicies
            listing={listing}
            onSaved={(patch) => {
              setListing((l) => ({ ...l, ...patch }));
              advance();
            }}
          />
        ) : null}

        {current.key === "review" ? (
          <StepReview
            host={host}
            profile={profile}
            listing={listing}
            photos={photos}
            rooms={rooms}
            bankAccounts={bankAccounts}
            done={done}
            onEditStep={(key) => {
              const idx = STEPS.findIndex((s) => s.key === key);
              if (idx >= 0) goTo(idx);
            }}
          />
        ) : null}

        {/* Footer nav — Review step has its own primary CTA */}
        {current.key !== "review" ? (
          <div className="mt-8 flex items-center justify-between border-t border-brand-line pt-5">
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                markDone(current.key);
                goTo(currentIndex + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
            >
              Skip for now <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function computeInitialDone(props: Props): Record<SetupStepKey, boolean> {
  // Shared predicate so the wizard and the dashboard checklist can't diverge.
  return computeSetupCompletion({
    host: props.host,
    hasBankAccount: props.bankAccounts.length > 0,
    listing: props.listing,
    photoCount: props.photos.length,
    roomCount: props.rooms.filter((r) => r.is_active).length,
  });
}

function ProgressRing({
  pct,
  doneCount,
  total,
}: {
  pct: number;
  doneCount: number;
  total: number;
}) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative hidden h-[88px] w-[88px] shrink-0 sm:block">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          className="setup-ring-bg"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="setup-ring-fg"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="num font-display text-lg font-bold leading-none text-white">
          {doneCount}
          <span className="text-sm text-white/60">/{total}</span>
        </div>
        <div className="mt-0.5 text-[9px] uppercase tracking-wider text-brand-accent/70">
          done
        </div>
      </div>
    </div>
  );
}

function pickInitialIndex(
  requested: string | null,
  done: Record<SetupStepKey, boolean>,
): number {
  if (requested) {
    const idx = STEPS.findIndex((s) => s.key === requested);
    if (idx >= 0) return idx;
  }
  const firstUndone = STEPS.findIndex((s) => !done[s.key]);
  return firstUndone < 0 ? 0 : firstUndone;
}
