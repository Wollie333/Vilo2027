"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-mute hover:text-brand-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Finish setting up
          </h1>
          <p className="mt-1 max-w-xl text-sm text-brand-mute">
            A few more details and you&rsquo;re ready to take real bookings.
            We&rsquo;ll save each step as you go.
          </p>
        </div>
        <div className="hidden text-right md:block">
          <div className="num font-display text-2xl font-bold text-brand-primary">
            {doneCount}
            <span className="text-brand-mute">/{STEPS.length}</span>
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-brand-mute">
            complete
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-6 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="h-1 w-full bg-brand-line">
          <div
            className="h-full bg-brand-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ol className="grid grid-cols-2 md:grid-cols-5">
          {STEPS.map((s, idx) => {
            const isDone = done[s.key];
            const isCurrent = idx === currentIndex;
            return (
              <li key={s.key} className="contents">
                <button
                  type="button"
                  onClick={() => goTo(idx)}
                  className={`flex items-center gap-3 border-r border-brand-line px-4 py-3 text-left transition last:border-r-0 ${
                    isCurrent
                      ? "bg-brand-accent/40"
                      : "bg-white hover:bg-brand-light/60"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-[11px] font-bold ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                          ? "bg-brand-primary text-white"
                          : "border border-brand-line bg-white text-brand-mute"
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`truncate text-[12.5px] font-semibold ${
                        isCurrent ? "text-brand-ink" : "text-brand-ink/80"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div className="truncate text-[10.5px] text-brand-mute">
                      {isDone ? "Done" : isCurrent ? "In progress" : "To do"}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Current step body */}
      <div className="rounded-card border border-brand-line bg-white p-6 shadow-card md:p-8">
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
            onRoomAdded={(r) => setRooms((list) => [...list, r])}
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
  const profileDone = Boolean(
    props.host.bio &&
    props.host.avatar_url &&
    props.host.languages_spoken.length > 0,
  );
  const bankingDone = props.bankAccounts.some((a) => a.is_default);
  const listingDone = Boolean(
    props.photos.length > 0 &&
    props.listing.base_price != null &&
    props.listing.max_guests != null,
  );
  const policiesDone = Boolean(
    props.listing.cancellation_policy &&
    props.listing.check_in_time &&
    props.listing.check_out_time,
  );
  const reviewDone = props.listing.is_published;
  return {
    profile: profileDone,
    banking: bankingDone,
    listing: listingDone,
    policies: policiesDone,
    review: reviewDone,
  };
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
