"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  PartyPopper,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  COUNTRIES,
  LANGUAGE_OPTIONS,
  PLANS,
  SA_REGIONS,
  accountSchema,
  aboutSchema,
  listingSchema,
} from "./schemas";
import {
  createAccountAction,
  finalizeOnboardingAction,
  uploadHostAvatarAction,
  type FinalizeOnboardingData,
} from "./actions";

// ─── Step machinery ───────────────────────────────────────────────

// 5-step host onboarding. The old "What you offer" step was removed —
// every host can list both accommodation AND experiences from day one;
// the kind picker for the FIRST listing happens inline in step 4.
const STEPS = [
  { key: "account", label: "Account", short: "Account" },
  { key: "about", label: "About you", short: "Profile" },
  { key: "listing", label: "First listing", short: "Listing" },
  { key: "plan", label: "Your toolkit", short: "Toolkit" },
  { key: "welcome", label: "Welcome", short: "Done" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

type WizardData = {
  // account
  fullName: string;
  email: string;
  password: string;
  showPassword: boolean;
  terms: boolean;
  // about
  phone: string;
  country: string;
  bio: string;
  languages: string[];
  avatarUrl: string;
  // listing — bare minimum to seed a draft. Capacity, pricing, duration,
  // photos and amenities all live in the listing editor post-onboarding.
  listingName: string;
  listingKind: "accommodation" | "experience";
  categoryId: string | null;
  // Legacy text columns — derived from the chosen category slug; the
  // picker writes both so the listings INSERT keeps the old columns
  // populated for backwards-compatible reads.
  accommodationType: string;
  experienceType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  // plan
  plan: "free" | "basic" | "pro" | "business";
  billingCycle: "monthly" | "annual";
};

type Prefilled = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  languages: string[] | null;
  country: string | null;
};

function initialData(prefilled: Prefilled): WizardData {
  return {
    fullName: prefilled.fullName ?? "",
    email: prefilled.email ?? "",
    password: "",
    showPassword: false,
    terms: prefilled.email !== null, // returning user → terms already accepted at first signup
    phone: prefilled.phone ?? "",
    country: prefilled.country ?? "South Africa",
    bio: prefilled.bio ?? "",
    languages:
      prefilled.languages && prefilled.languages.length > 0
        ? prefilled.languages
        : ["English"],
    avatarUrl: prefilled.avatarUrl ?? "",
    listingName: "",
    listingKind: "accommodation",
    categoryId: null,
    accommodationType: "",
    experienceType: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "Western Cape",
    postalCode: "",
    plan: "free",
    billingCycle: "monthly",
  };
}

const SIDE_RAIL: Record<
  StepKey,
  {
    eyebrow: string;
    title: string;
    body: string;
    proof?: { quote: string; name: string; role: string; initials: string };
  }
> = {
  account: {
    eyebrow: "Free to join",
    title: "Direct bookings. Zero booking fees.",
    body: "You keep 100% of what guests pay. We charge one flat subscription — no commission on bookings, ever.",
    proof: {
      quote:
        "I cancelled my Airbnb listing 6 months ago. Booking direct via Vilo means I keep R3 200 a month I used to lose to fees.",
      name: "Lerato M.",
      role: "Featherstone Guesthouse · Knysna",
      initials: "LM",
    },
  },
  about: {
    eyebrow: "Why this matters",
    title: "A profile guests trust.",
    body: "Hosts with a photo and bio get 2.3× more enquiries on average. It takes 60 seconds.",
  },
  listing: {
    eyebrow: "Step by step",
    title: "Stays or experiences — pick one to start.",
    body: "We seed your first listing here. You can add a second listing of either kind from your dashboard, and finish photos, pricing and amenities in the listing editor.",
  },
  plan: {
    eyebrow: "Currently free",
    title: "Every host starts on Free.",
    body: "Paid tiers are coming — you'll be able to upgrade from settings once payments ship. No card needed today.",
  },
  welcome: {
    eyebrow: "You're live",
    title: "Time to take direct bookings.",
    body: "Share your profile URL with past guests, on Instagram and on your website. Every booking lands straight in your Vilo inbox.",
  },
};

// ─── Root component ───────────────────────────────────────────────

// Map Zod schema field names (snake_case) → wizard state field names
// (camelCase) so we can render errors next to the right inputs.
const ERROR_KEY_MAP: Record<string, string> = {
  full_name: "fullName",
  listing_name: "listingName",
  // Everything else (email, password, terms, phone, bio, city, rate, …)
  // already matches between schema and state, so no rewrite needed.
};

function zodIssuesToFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const first = issue.path[0];
    if (typeof first !== "string") continue;
    const key = ERROR_KEY_MAP[first] ?? first;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function Wizard({
  prefilledEmail,
  prefilledFullName = null,
  prefilledPhone = null,
  prefilledBio = null,
  prefilledAvatar = null,
  prefilledLanguages = null,
  prefilledCountry = null,
  categoryLeaves = [],
}: {
  prefilledEmail: string | null;
  prefilledFullName?: string | null;
  prefilledPhone?: string | null;
  prefilledBio?: string | null;
  prefilledAvatar?: string | null;
  prefilledLanguages?: string[] | null;
  prefilledCountry?: string | null;
  categoryLeaves?: Array<{
    id: string;
    label: string;
    slug: string;
    kind: "accommodation" | "experience";
    description: string | null;
  }>;
}) {
  // Returning users (already signed in) skip Step 1.
  const startIndex = prefilledEmail ? 1 : 0;
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [data, setData] = useState<WizardData>(() =>
    initialData({
      email: prefilledEmail,
      fullName: prefilledFullName,
      phone: prefilledPhone,
      bio: prefilledBio,
      avatarUrl: prefilledAvatar,
      languages: prefilledLanguages,
      country: prefilledCountry,
    }),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createPending, startCreate] = useTransition();
  const [finalizePending, startFinalize] = useTransition();
  // Returned by finalizeOnboardingAction — drives the receipt on the
  // Welcome step (host id for the order reference + confirmed plan).
  const [finalizeResult, setFinalizeResult] =
    useState<FinalizeOnboardingData | null>(null);

  const current = STEPS[currentIndex];
  const isLast = currentIndex === STEPS.length - 1;

  function patch(p: Partial<WizardData>) {
    setData((d) => ({ ...d, ...p }));
    // Clear errors for any field the user is editing so they fade as the
    // user fixes them rather than waiting for a re-validate on next.
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      for (const k of Object.keys(p)) delete next[k];
      return next;
    });
  }

  function jumpBack(index: number) {
    if (index < currentIndex) {
      setCurrentIndex(index);
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function advance() {
    setCurrentIndex((i) => Math.min(STEPS.length - 1, i + 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAccountNext() {
    const parsed = accountSchema.safeParse({
      full_name: data.fullName,
      email: data.email,
      password: data.password,
      terms: data.terms,
    });
    if (!parsed.success) {
      setErrors(zodIssuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    startCreate(async () => {
      const result = await createAccountAction({
        full_name: data.fullName,
        email: data.email,
        password: data.password,
        terms: data.terms,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      advance();
    });
  }

  function handleAboutNext() {
    const parsed = aboutSchema.safeParse({
      phone: data.phone,
      country: data.country,
      bio: data.bio,
      languages: data.languages,
      avatar_url: data.avatarUrl,
    });
    if (!parsed.success) {
      setErrors(zodIssuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    advance();
  }

  function handleListingNext() {
    const parsed = listingSchema.safeParse({
      listing_name: data.listingName,
      listing_kind: data.listingKind,
      category_id: data.categoryId,
      accommodation_type:
        data.listingKind === "accommodation"
          ? data.accommodationType || undefined
          : undefined,
      experience_type:
        data.listingKind === "experience"
          ? data.experienceType || undefined
          : undefined,
      address_line1: data.addressLine1,
      address_line2: data.addressLine2,
      city: data.city,
      region: data.region,
      postal_code: data.postalCode,
    });
    if (!parsed.success) {
      setErrors(zodIssuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    advance();
  }

  function handlePlanNext() {
    // Plan is always 'free' on submit — every signup goes through as Free
    // for now. We finalize first (write host row + subscription) and only
    // advance to the Welcome / receipt step on success, so the user never
    // lands on a thank-you page for an order that didn't actually persist.
    startFinalize(async () => {
      const result = await finalizeOnboardingAction({
        full_name: data.fullName,
        phone: data.phone,
        country: data.country,
        bio: data.bio,
        languages: data.languages,
        avatar_url: data.avatarUrl,
        listing_name: data.listingName,
        listing_kind: data.listingKind,
        category_id: data.categoryId,
        accommodation_type:
          data.listingKind === "accommodation"
            ? data.accommodationType || undefined
            : undefined,
        experience_type:
          data.listingKind === "experience"
            ? data.experienceType || undefined
            : undefined,
        address_line1: data.addressLine1,
        address_line2: data.addressLine2,
        city: data.city,
        region: data.region,
        postal_code: data.postalCode,
        plan: data.plan,
        billing_cycle: data.billingCycle,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFinalizeResult(result.data ?? null);
      advance();
    });
  }

  function onNext() {
    switch (current.key) {
      case "account":
        handleAccountNext();
        break;
      case "about":
        handleAboutNext();
        break;
      case "listing":
        handleListingNext();
        break;
      case "plan":
        handlePlanNext();
        break;
    }
  }

  const nextLabel =
    current.key === "account"
      ? createPending
        ? "Creating account…"
        : "Create account"
      : current.key === "plan"
        ? finalizePending
          ? "Setting up…"
          : data.plan === "free"
            ? "Start with Free"
            : "Start 14-day trial"
        : "Continue";
  const nextDisabled = createPending || finalizePending;

  const stepBody = (() => {
    switch (current.key) {
      case "account":
        return (
          <StepAccount
            data={data}
            patch={patch}
            errors={errors}
            pending={createPending}
            stepIndex={currentIndex}
          />
        );
      case "about":
        return (
          <StepAbout
            data={data}
            patch={patch}
            errors={errors}
            stepIndex={currentIndex}
          />
        );
      case "listing":
        return (
          <StepListing
            data={data}
            patch={patch}
            errors={errors}
            stepIndex={currentIndex}
            categoryLeaves={categoryLeaves}
          />
        );
      case "plan":
        return <StepPlan stepIndex={currentIndex} />;
      case "welcome":
        return (
          <StepWelcome
            data={data}
            finalizePending={finalizePending}
            finalizeResult={finalizeResult}
          />
        );
    }
  })();

  return (
    <div className="min-h-screen w-full bg-brand-light text-brand-ink">
      {/* Top bar — mobile only */}
      <div className="border-b border-brand-line bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ViloMark size={28} />
            <div className="font-display font-bold text-brand-ink">Vilo</div>
          </div>
          <Link
            href="/login"
            className="text-xs text-brand-mute hover:text-brand-ink"
          >
            Already a host?{" "}
            <span className="font-medium text-brand-primary">Sign in</span>
          </Link>
        </div>
      </div>

      {/* Full-bleed shell */}
      <div className="grid min-h-screen lg:grid-cols-[440px_1fr] xl:grid-cols-[520px_1fr]">
        <SideRail stepKey={current.key} current={currentIndex} />

        <div className="flex min-w-0 flex-col bg-white">
          {/* Sticky stepper bar */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-brand-line bg-white/95 px-6 py-5 backdrop-blur lg:px-12 lg:py-6">
            <div className="min-w-0 flex-1">
              <Stepper current={currentIndex} onJump={jumpBack} />
            </div>
            <Link
              href="/login"
              className="hidden shrink-0 text-xs text-brand-mute hover:text-brand-ink lg:inline-flex"
            >
              Already a host?{" "}
              <span className="ml-1 font-medium text-brand-primary">
                Sign in
              </span>
            </Link>
          </div>

          {/* Step body */}
          <div className="flex-1 px-6 py-10 lg:px-12 lg:py-14 xl:px-16">
            <div className="mx-auto w-full max-w-3xl">{stepBody}</div>
          </div>

          {/* Sticky footer */}
          {!isLast ? (
            <div className="sticky bottom-0 z-10 border-t border-brand-line bg-brand-light/40 px-6 py-4 lg:px-12 xl:px-16">
              <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentIndex === 0 || nextDisabled}
                  className="inline-flex items-center gap-1.5 text-sm text-brand-mute hover:text-brand-ink disabled:opacity-40 disabled:hover:text-brand-mute"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex items-center gap-2">
                  {currentIndex > 0 && currentIndex < STEPS.length - 1 ? (
                    <Link
                      href="/dashboard"
                      className="rounded border border-brand-line bg-white px-4 py-2 text-sm text-brand-ink transition hover:bg-white/90"
                    >
                      Save &amp; finish later
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={onNext}
                    disabled={nextDisabled}
                    className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
                  >
                    {nextLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mx-auto mt-3 w-full max-w-3xl text-center text-[11px] text-brand-mute lg:text-left">
                By continuing, you agree to Vilo&apos;s Terms of Service.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Side rail ────────────────────────────────────────────────────

function SideRail({ stepKey, current }: { stepKey: StepKey; current: number }) {
  const c = SIDE_RAIL[stepKey];
  return (
    <aside className="relative flex flex-col overflow-hidden bg-brand-gradient-dark p-7 text-white lg:sticky lg:top-0 lg:h-screen lg:p-12 xl:p-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30"
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ViloMark size={36} glow />
          <div>
            <div className="font-display font-bold leading-none">Vilo</div>
            <div className="mt-0.5 text-[10px] text-emerald-200/70">
              Host onboarding
            </div>
          </div>
        </div>
        <div className="font-mono text-[11px] text-emerald-200/70">
          {String(current + 1).padStart(2, "0")} /{" "}
          {String(STEPS.length).padStart(2, "0")}
        </div>
      </div>

      <div className="relative mt-10 flex-1 lg:mt-16">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
          {c.eyebrow}
        </div>
        <h3 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight lg:text-3xl">
          {c.title}
        </h3>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-emerald-100/75 lg:text-[15px]">
          {c.body}
        </p>

        {c.proof ? (
          <div className="mt-8 rounded-card border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-1 text-amber-300">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-emerald-50/90">
              &ldquo;{c.proof.quote}&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-pill bg-brand-accent/40 text-[10px] font-semibold text-brand-secondary">
                {c.proof.initials}
              </div>
              <div>
                <div className="text-xs font-semibold">{c.proof.name}</div>
                <div className="text-[11px] text-emerald-200/70">
                  {c.proof.role}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { v: "0%", l: "Booking fees" },
            { v: "1.2k+", l: "SA hosts" },
            { v: "R0", l: "To start" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5"
            >
              <div className="font-display text-lg font-bold">{s.v}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-emerald-200/70">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-5 text-[11px] text-emerald-200/70">
        <span>
          Need a hand?{" "}
          <Link
            href="/help"
            className="text-white underline underline-offset-2"
          >
            Chat with support
          </Link>
        </span>
        <span>© Vilo 2026</span>
      </div>
    </aside>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────

function Stepper({
  current,
  onJump,
}: {
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="vilo-hide-sb flex items-center gap-1 overflow-x-auto md:gap-3">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center gap-1 md:gap-3">
            <button
              type="button"
              onClick={() => done && onJump(i)}
              disabled={!done}
              className={`flex shrink-0 items-center gap-2 ${
                done ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-pill text-xs font-semibold ${
                  done
                    ? "bg-brand-primary text-white"
                    : active
                      ? "vilo-ring-pulse border-2 border-brand-primary bg-white text-brand-primary"
                      : "border border-brand-line bg-white text-brand-mute"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="hidden text-left md:block">
                <div
                  className={`text-xs font-medium ${
                    done
                      ? "text-brand-ink"
                      : active
                        ? "text-brand-primary"
                        : "text-brand-mute"
                  }`}
                >
                  {s.label}
                </div>
                <div className="text-[10px] text-brand-mute">
                  {done
                    ? "Completed"
                    : active
                      ? `Step ${i + 1} of ${STEPS.length}`
                      : "—"}
                </div>
              </div>
            </button>
            {i < STEPS.length - 1 ? (
              <div
                className={`h-px min-w-3 flex-1 md:min-w-6 ${
                  i < current ? "bg-brand-primary" : "bg-brand-line"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Account ──────────────────────────────────────────────

function StepAccount({
  data,
  patch,
  errors,
  pending,
  stepIndex,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  errors: Record<string, string>;
  pending: boolean;
  stepIndex: number;
}) {
  function notifyOAuthSoon() {
    toast.info("Email signup is the only option during the MVP build.");
  }
  return (
    <div className="vilo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="Create your host account"
        subtitle="Just the basics — you can edit everything later in settings."
      />

      <div className="mt-7 space-y-5">
        {/* OAuth — visual only during MVP build */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={notifyOAuthSoon}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-light/60 disabled:opacity-60"
          >
            <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 7.1 29.3 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.4 26.7 36 24 36c-5.3 0-9.7-3.5-11.3-8.4l-6.6 5.1C9.6 38.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C40.5 35.9 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z"
              />
            </svg>
            Continue with Google
          </button>
          <button
            type="button"
            onClick={notifyOAuthSoon}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-light/60 disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-current"
              aria-hidden
            >
              <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.95 1.57-2.96 1.49-.12-1.1.486-2.27 1.16-3.05.755-.88 2.05-1.55 2.97-1.52zM20.5 17.16c-.39.9-.86 1.76-1.41 2.55-.74 1.07-1.74 2.4-2.97 2.42-1.1.02-1.39-.71-2.88-.7-1.49.01-1.81.72-2.91.71-1.24-.01-2.18-1.19-2.92-2.26-2.08-3.01-3.69-8.53-1.54-12.26.93-1.6 2.6-2.62 4.4-2.65 1.21-.02 2.35.81 3.09.81.74 0 2.13-1 3.6-.85.61.03 2.31.25 3.4 1.86-.09.05-2.04 1.2-2.02 3.56.02 2.82 2.47 3.76 2.5 3.78-.02.06-.39 1.34-1.34 2.74z" />
            </svg>
            Continue with Apple
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-brand-line" />
          <span className="text-[11px] uppercase tracking-wider text-brand-mute">
            or with email
          </span>
          <div className="h-px flex-1 bg-brand-line" />
        </div>

        <FormField label="Full name" error={errors.fullName}>
          <TextInput
            value={data.fullName}
            onChange={(e) => patch({ fullName: e.target.value })}
            placeholder="Lerato Mokoena"
            disabled={pending}
            autoComplete="name"
          />
        </FormField>

        <FormField label="Email" error={errors.email}>
          <TextInput
            type="email"
            value={data.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="you@yourbusiness.co.za"
            disabled={pending}
            autoComplete="email"
          />
        </FormField>

        <FormField
          label="Password"
          hint="At least 8 characters."
          error={errors.password}
        >
          <div className="relative">
            <TextInput
              type={data.showPassword ? "text" : "password"}
              value={data.password}
              onChange={(e) => patch({ password: e.target.value })}
              placeholder="••••••••"
              className="pr-10"
              disabled={pending}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => patch({ showPassword: !data.showPassword })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-mute hover:text-brand-ink"
              tabIndex={-1}
            >
              {data.showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </FormField>

        <div>
          <label className="flex cursor-pointer select-none items-start gap-2.5">
            <input
              type="checkbox"
              checked={data.terms}
              onChange={(e) => patch({ terms: e.target.checked })}
              disabled={pending}
              className="mt-0.5 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-xs leading-relaxed text-brand-mute">
              I agree to Vilo&apos;s{" "}
              <Link
                href="/terms"
                className="text-brand-primary hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-brand-primary hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.terms ? (
            <div className="mt-1.5 text-xs text-red-600">{errors.terms}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: About you ─────────────────────────────────────────────

function StepAbout({
  data,
  patch,
  errors,
  stepIndex,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  errors: Record<string, string>;
  stepIndex: number;
}) {
  const initials =
    (data.fullName || "V")
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "V";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadPending, setUploadPending] = useState(false);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large — max 5MB.");
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed.");
      e.target.value = "";
      return;
    }
    setUploadPending(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadHostAvatarAction(fd);
    setUploadPending(false);
    e.target.value = "";
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    patch({ avatarUrl: result.data?.url ?? "" });
    toast.success("Photo uploaded");
  }

  return (
    <div className="vilo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="A bit about you"
        subtitle="Guests see this on your public profile. A photo and short bio earn trust."
      />

      <div className="mt-7 space-y-5">
        {/* Real avatar upload — goes to the `avatars` Storage bucket. */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {data.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.avatarUrl}
                alt="Your profile photo"
                className="h-16 w-16 rounded-pill border border-brand-line object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-accent text-base font-semibold text-brand-secondary">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPending}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line bg-white text-brand-ink shadow-card hover:bg-brand-accent disabled:opacity-50"
              aria-label="Upload profile photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-sm">
            <div className="font-medium text-brand-ink">Profile photo</div>
            <div className="mt-0.5 text-xs text-brand-mute">
              Square, at least 400×400. JPG or PNG. Max 5MB.
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPending}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline disabled:opacity-50"
            >
              <Upload className="h-3 w-3" />
              {uploadPending
                ? "Uploading…"
                : data.avatarUrl
                  ? "Replace photo"
                  : "Upload photo"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChosen}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Phone number"
            hint="Required — used for booking-critical SMS."
            error={errors.phone}
          >
            <div className="flex">
              <span className="inline-flex items-center rounded-l border border-r-0 border-brand-line bg-brand-light/60 px-3 font-mono text-sm text-brand-mute">
                +27
              </span>
              <TextInput
                value={data.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="82 123 4567"
                className="rounded-l-none"
              />
            </div>
          </FormField>

          <FormField label="Country">
            <SelectInput
              value={data.country}
              onChange={(e) => patch({ country: e.target.value })}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <FormField
          label="Short bio"
          optional
          hint="A sentence or two about you and your hospitality style."
          error={errors.bio}
        >
          <TextAreaInput
            rows={3}
            value={data.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            placeholder="We've been hosting in the Karoo since 2018. Slow mornings, big skies, fresh bread."
            maxLength={240}
          />
          <div className="mt-1 text-right text-[11px] text-brand-mute">
            {(data.bio || "").length} / 240
          </div>
        </FormField>

        <FormField label="Languages you speak" optional>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((l) => {
              const on = data.languages.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() =>
                    patch({
                      languages: on
                        ? data.languages.filter((x) => x !== l)
                        : [...data.languages, l],
                    })
                  }
                  className={`rounded-pill border px-3 py-1 text-xs font-medium transition-colors ${
                    on
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line bg-white text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
                  }`}
                >
                  {on ? <Check className="-mt-px mr-1 inline h-3 w-3" /> : null}
                  {l}
                </button>
              );
            })}
          </div>
        </FormField>
      </div>
    </div>
  );
}

// ─── Step 3: First listing ─────────────────────────────────────────

function StepListing({
  data,
  patch,
  errors,
  stepIndex,
  categoryLeaves,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  errors: Record<string, string>;
  stepIndex: number;
  categoryLeaves: Array<{
    id: string;
    label: string;
    slug: string;
    kind: "accommodation" | "experience";
    description: string | null;
  }>;
}) {
  const isExperience = data.listingKind === "experience";
  const kindLeaves = categoryLeaves.filter((l) =>
    isExperience ? l.kind === "experience" : l.kind === "accommodation",
  );
  return (
    <div className="vilo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="Tell us about your first listing"
        subtitle="The basics now — name, kind, and address. Photos, amenities, and pricing come in the listing editor right after."
      />

      <div className="mt-7 space-y-6">
        {/* Listing kind toggle — host can list both kinds; pick which one
            to start with. The other can be added from the dashboard. */}
        <FormField label="Is this an accommodation or an experience?">
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                v: "accommodation" as const,
                label: "Accommodation",
                sub: "Guesthouse, lodge, villa, cottage…",
              },
              {
                v: "experience" as const,
                label: "Experience",
                sub: "Tour, activity, workshop, transfer…",
              },
            ].map((opt) => {
              const on = data.listingKind === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() =>
                    patch({
                      listingKind: opt.v,
                      // Different kind = different leaf set. Clear the
                      // previous pick so the host re-selects from the
                      // matching options.
                      categoryId: null,
                      accommodationType: "",
                      experienceType: "",
                    })
                  }
                  className={`rounded-card border p-3 text-left transition-colors ${
                    on
                      ? "border-brand-primary bg-brand-accent/40"
                      : "border-brand-line bg-white hover:border-brand-primary/40"
                  }`}
                >
                  <div className="text-sm font-semibold text-brand-ink">
                    {opt.label}
                  </div>
                  <div className="mt-0.5 text-xs text-brand-mute">
                    {opt.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label={isExperience ? "Experience name" : "Listing name"}
            error={errors.listingName}
          >
            <TextInput
              value={data.listingName}
              onChange={(e) => patch({ listingName: e.target.value })}
              placeholder={
                isExperience ? "Sunrise Canoe Tour" : "Cape Town Boutique B&B"
              }
            />
          </FormField>

          <FormField
            label={isExperience ? "Experience type" : "Property type"}
            error={errors.category_id}
          >
            <SelectInput
              value={data.categoryId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const leaf = kindLeaves.find((l) => l.id === id);
                if (!leaf) {
                  patch({ categoryId: null });
                  return;
                }
                patch({
                  categoryId: leaf.id,
                  // Mirror onto the legacy column so the listings INSERT
                  // populates both. Cleared for the opposite kind in the
                  // server action.
                  accommodationType: isExperience ? "" : leaf.slug,
                  experienceType: isExperience ? leaf.slug : "",
                });
              }}
            >
              <option value="">Pick a category…</option>
              {kindLeaves.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        {/* Address block */}
        <div className="space-y-3 rounded-card border border-brand-line bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-mute">
            {isExperience ? "Meeting point address" : "Property address"}
          </div>

          <FormField
            label={isExperience ? "Street / location" : "Street address"}
            error={errors.addressLine1}
          >
            <TextInput
              value={data.addressLine1}
              onChange={(e) => patch({ addressLine1: e.target.value })}
              placeholder={
                isExperience
                  ? "Slipway entrance, V&A Waterfront"
                  : "12 Main Road"
              }
            />
          </FormField>

          <FormField
            label="Suite / unit / building (optional)"
            error={errors.addressLine2}
          >
            <TextInput
              value={data.addressLine2}
              onChange={(e) => patch({ addressLine2: e.target.value })}
              placeholder="Unit 3 / The Oak Cottage / Building B"
            />
          </FormField>

          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="City / town" error={errors.city}>
              <TextInput
                value={data.city}
                onChange={(e) => patch({ city: e.target.value })}
                placeholder="Cape Town"
              />
            </FormField>

            <FormField label="Province / region">
              <SelectInput
                value={data.region}
                onChange={(e) => patch({ region: e.target.value })}
              >
                {SA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Postal code" error={errors.postalCode}>
              <TextInput
                value={data.postalCode}
                onChange={(e) => patch({ postalCode: e.target.value })}
                placeholder="8001"
                inputMode="numeric"
              />
            </FormField>
          </div>

          <p className="text-[11px] text-brand-mute">
            Only the city &amp; region are shown publicly. The full address is
            shared with confirmed guests after booking.
          </p>
        </div>

        <div className="rounded-card border border-brand-line bg-brand-light/40 p-4 text-xs text-brand-mute">
          <p className="font-medium text-brand-ink">
            Capacity, pricing, photos &amp; the rest — added next.
          </p>
          <p className="mt-1">
            We seed your listing as a{" "}
            <span className="font-semibold">draft</span>. Once onboarding
            finishes you&rsquo;ll land in the listing editor where you add cover
            photos, set your rate, capacity / duration, cancellation policy,
            amenities and house rules — and publish when you&rsquo;re ready.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Subscription ──────────────────────────────────────────

function StepPlan({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="vilo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="You're on the Free plan"
        subtitle="Every host starts here with full access to all features while we finalise billing. Paid tiers below are coming — you'll be able to upgrade from settings once payments ship."
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const isCurrent = p.value === "free";
          return (
            <div
              key={p.value}
              className={`relative flex flex-col rounded-card border p-5 ${
                isCurrent
                  ? "border-brand-primary bg-white shadow-glow"
                  : "border-brand-line bg-white opacity-90"
              }`}
            >
              <span
                className={`absolute -top-2 right-4 rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                  isCurrent
                    ? "bg-brand-primary text-white"
                    : "border border-brand-line bg-brand-light text-brand-mute"
                }`}
              >
                {isCurrent ? "Your plan today" : "Coming soon"}
              </span>

              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-bold text-brand-ink">
                  {p.name}
                </div>
                {isCurrent ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-pill bg-brand-primary text-white">
                    <Check className="h-3 w-3" />
                  </div>
                ) : null}
              </div>
              <p className="mt-1.5 min-h-[32px] text-xs text-brand-mute">
                {p.blurb}
              </p>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold text-brand-ink">
                  R{p.monthly.toLocaleString("en-ZA")}
                </span>
                <span className="text-xs text-brand-mute">
                  {p.value === "free" ? "" : "/month"}
                </span>
              </div>

              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs text-brand-ink"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
                    <span className="leading-snug">{f}</span>
                  </li>
                ))}
              </ul>

              <div
                className={`mt-5 rounded py-2 text-center text-xs font-semibold ${
                  isCurrent
                    ? "bg-brand-primary text-white"
                    : "border border-brand-line bg-brand-light text-brand-mute"
                }`}
              >
                {isCurrent ? "Active" : "Notify me at launch"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-card border border-brand-line bg-white p-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="text-xs leading-relaxed text-brand-mute">
          No card required today. When paid tiers launch you&rsquo;ll see an
          upgrade prompt in your dashboard — your data, listings and bookings
          carry over.
        </div>
      </div>
    </div>
  );
}

// ─── Step 6: Welcome ───────────────────────────────────────────────

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
    return Array.from({ length: 60 }).map((_, i) => ({
      left: Math.random() * 100,
      dx: `${Math.random() * 200 - 100}px`,
      d: `${(3 + Math.random() * 2.5).toFixed(2)}s`,
      delay: `${(Math.random() * 1.2).toFixed(2)}s`,
      bg: colors[i % colors.length],
      rot: Math.random() * 180,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="vilo-confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.bg,
              transform: `rotate(${p.rot}deg)`,
              ["--dx" as never]: p.dx,
              ["--d" as never]: p.d,
              ["--delay" as never]: p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function StepWelcome({
  data,
  finalizePending,
  finalizeResult,
}: {
  data: WizardData;
  finalizePending: boolean;
  finalizeResult: FinalizeOnboardingData | null;
}) {
  // Resolve the plan the user picked. PLANS is the source of truth for
  // pricing + features so the receipt always matches what was shown on
  // the Plan step.
  const plan = PLANS.find((p) => p.value === data.plan) ?? PLANS[0];
  const isFree = plan.value === "free";
  const cycle = data.billingCycle;
  const baseAmount = cycle === "annual" ? plan.annual : plan.monthly;
  // 15% VAT is South Africa's standard rate. We assume the displayed plan
  // price is VAT-inclusive (industry standard for consumer SaaS in SA), so
  // we split it out on the receipt for transparency.
  const vatRate = 0.15;
  const subtotal = Math.round((baseAmount / (1 + vatRate)) * 100) / 100;
  const vat = Math.round((baseAmount - subtotal) * 100) / 100;
  const total = baseAmount;

  // Order reference: VILO-{yyyymmdd}-{first6OfHostId}. Falls back to a
  // session-stable placeholder while finalize is in flight.
  const today = new Date();
  const yyyymmdd =
    `${today.getFullYear()}` +
    `${String(today.getMonth() + 1).padStart(2, "0")}` +
    `${String(today.getDate()).padStart(2, "0")}`;
  const ref = finalizeResult
    ? `VILO-${yyyymmdd}-${finalizeResult.host_id.replace(/-/g, "").slice(0, 6).toUpperCase()}`
    : `VILO-${yyyymmdd}-……`;

  return (
    <div className="vilo-step-enter relative">
      <Confetti />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-[11px] font-semibold text-brand-secondary">
          <PartyPopper className="h-3.5 w-3.5" />{" "}
          {finalizePending ? "Wrapping up…" : "Order confirmed"}
        </div>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
          Thanks, {(data.fullName || "host").split(" ")[0]}. You&rsquo;re in.
        </h2>
        <p className="mt-2 max-w-xl text-sm text-brand-mute md:text-base">
          Here&rsquo;s a summary of your Vilo membership. A copy has been sent
          to{" "}
          <span className="font-medium text-brand-ink">
            {data.email || "your email"}
          </span>
          .
        </p>

        {/* Receipt */}
        <div className="mt-6 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          {/* Receipt header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-line bg-brand-light/50 px-5 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Membership
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-display text-xl font-bold text-brand-ink">
                  {plan.name}
                </span>
                {plan.tag ? (
                  <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-secondary">
                    {plan.tag}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-brand-mute">{plan.blurb}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Order reference
              </div>
              <div className="num mt-1 font-mono text-sm font-semibold text-brand-ink">
                {ref}
              </div>
              <div className="mt-1 text-xs text-brand-mute">
                {today.toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between border-b border-brand-line pb-3">
              <div>
                <div className="text-sm font-semibold text-brand-ink">
                  {plan.name} plan · {cycle === "annual" ? "Annual" : "Monthly"}
                </div>
                <div className="mt-0.5 text-xs text-brand-mute">
                  Billed {cycle === "annual" ? "yearly" : "monthly"} · cancel
                  anytime from settings
                </div>
              </div>
              <div className="num font-display text-base font-bold text-brand-ink">
                {isFree
                  ? "R 0"
                  : `R ${baseAmount.toLocaleString("en-ZA").replace(/,/g, " ")}`}
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-xs text-brand-mute"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Totals */}
          <div className="border-t border-brand-line bg-brand-light/40 px-5 py-4">
            {isFree ? (
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-brand-ink">
                  Total
                </div>
                <div className="num font-display text-lg font-bold text-brand-primary">
                  R 0 · No payment required
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-brand-mute">
                  <span>Subtotal</span>
                  <span className="num font-mono text-brand-ink">
                    R{" "}
                    {subtotal
                      .toLocaleString("en-ZA", { minimumFractionDigits: 2 })
                      .replace(/,/g, " ")}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-brand-mute">
                  <span>VAT · 15%</span>
                  <span className="num font-mono text-brand-ink">
                    R{" "}
                    {vat
                      .toLocaleString("en-ZA", { minimumFractionDigits: 2 })
                      .replace(/,/g, " ")}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-brand-line pt-3">
                  <div className="text-sm font-semibold text-brand-ink">
                    Total
                  </div>
                  <div className="num font-display text-lg font-bold text-brand-ink">
                    R{" "}
                    {total
                      .toLocaleString("en-ZA", { minimumFractionDigits: 2 })
                      .replace(/,/g, " ")}{" "}
                    <span className="text-xs font-normal text-brand-mute">
                      /{cycle === "annual" ? "yr" : "mo"}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-brand-mute">
                  Paid plans are not yet billable — every account starts on Free
                  until payments ship. You&rsquo;ll be asked to confirm before
                  any charge.
                </div>
              </>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex justify-end">
          <Link
            href="/dashboard?welcome=1"
            className={`inline-flex items-center gap-2 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-secondary ${
              finalizePending ? "pointer-events-none opacity-60" : ""
            }`}
            aria-disabled={finalizePending}
          >
            Go to dashboard <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Tiny form atoms ──────────────────────────────────────────────

function FormField({
  label,
  hint,
  optional,
  error,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-brand-ink">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-brand-mute">(optional)</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <div className="mt-1.5 text-xs text-red-600">{error}</div>
      ) : hint ? (
        <div className="mt-1.5 text-xs text-brand-mute">{hint}</div>
      ) : null}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink transition placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15 ${className ?? ""}`}
    />
  );
}

function TextAreaInput(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full resize-none rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink transition placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15 ${className ?? ""}`}
    />
  );
}

function SelectInput({
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className="w-full appearance-none rounded border border-brand-line bg-white px-3.5 py-2.5 pr-9 text-sm text-brand-ink transition focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
    </div>
  );
}

function StepHeading({
  stepIndex,
  title,
  subtitle,
}: {
  stepIndex: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
        Step {stepIndex + 1} of {STEPS.length - 1}
      </div>
      <h2 className="mt-1.5 font-display text-2xl font-bold text-brand-ink md:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm text-brand-mute">{subtitle}</p>
    </div>
  );
}

// ─── Inline logo ──────────────────────────────────────────────────

function ViloMark({
  size = 36,
  glow = false,
}: {
  size?: number;
  glow?: boolean;
}) {
  const id = useMemo(
    () => `vilo-grad-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={
        glow
          ? { filter: "drop-shadow(0 8px 20px rgba(16,185,129,0.45))" }
          : undefined
      }
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={`url(#${id})`} />
      <path
        d="M50 76L20 32H36L50 56L64 32H80L50 76Z"
        fill="white"
        opacity="0.4"
      />
      <path
        d="M50 66L26 32H38L50 50L62 32H74L50 66Z"
        fill="white"
        opacity="0.7"
      />
      <path d="M50 56L32 32H40L50 46L60 32H68L50 56Z" fill="white" />
    </svg>
  );
}
