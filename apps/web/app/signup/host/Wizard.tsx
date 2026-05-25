"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  ImagePlus,
  Info,
  Layers,
  Minus,
  PartyPopper,
  Plus,
  RotateCcw,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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
import { createAccountAction, finalizeOnboardingAction } from "./actions";

// ─── Step machinery ───────────────────────────────────────────────

const STEPS = [
  { key: "account", label: "Account", short: "Account" },
  { key: "about", label: "About you", short: "Profile" },
  { key: "offer", label: "What you offer", short: "Offering" },
  { key: "listing", label: "First listing", short: "Listing" },
  { key: "plan", label: "Subscription", short: "Plan" },
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
  // offer
  offering: "accommodation" | "experiences" | "both";
  // listing
  listingName: string;
  listingKind: "accommodation" | "experience";
  accommodationType:
    | "guesthouse"
    | "bb"
    | "self_catering"
    | "lodge"
    | "hotel"
    | "cottage"
    | "villa";
  experienceType: "tour" | "activity" | "workshop" | "transfer" | "other";
  city: string;
  region: string;
  maxGuests: number;
  durationHours: number;
  rate: string;
  coverUploaded: boolean;
  // plan
  plan: "free" | "basic" | "pro" | "business";
  billingCycle: "monthly" | "annual";
};

function initialData(prefilledEmail: string | null): WizardData {
  return {
    fullName: "",
    email: prefilledEmail ?? "",
    password: "",
    showPassword: false,
    terms: false,
    phone: "",
    country: "South Africa",
    bio: "",
    languages: ["English"],
    offering: "accommodation",
    listingName: "",
    listingKind: "accommodation",
    accommodationType: "guesthouse",
    experienceType: "tour",
    city: "",
    region: "Western Cape",
    maxGuests: 4,
    durationHours: 3,
    rate: "",
    coverUploaded: false,
    plan: "pro",
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
  offer: {
    eyebrow: "Built for SA",
    title: "Stays & experiences, one inbox.",
    body: "Whether you run a guesthouse, lead canoe tours, or both — every booking and message lives in a single dashboard.",
  },
  listing: {
    eyebrow: "Step by step",
    title: "The basics now. Polish later.",
    body: "We only ask for the minimum to get you live. Photos, seasonal pricing, house rules and amenities all live in the full editor — no rush.",
  },
  plan: {
    eyebrow: "No lock-in",
    title: "Pick a plan to test with.",
    body: "Billing isn't live yet — every signup goes through as free for now. You'll be able to upgrade from settings once payments ship.",
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

export function Wizard({ prefilledEmail }: { prefilledEmail: string | null }) {
  const startIndex = prefilledEmail ? 1 : 0;
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [data, setData] = useState<WizardData>(() =>
    initialData(prefilledEmail),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createPending, startCreate] = useTransition();
  const [finalizePending, startFinalize] = useTransition();

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
    });
    if (!parsed.success) {
      setErrors(zodIssuesToFieldErrors(parsed.error.issues));
      return;
    }
    advance();
  }

  function handleListingNext() {
    // Mirror offer choice into listingKind if not already aligned.
    const inferredKind: "accommodation" | "experience" =
      data.offering === "experiences" ? "experience" : "accommodation";
    const parsed = listingSchema.safeParse({
      listing_name: data.listingName,
      listing_kind: inferredKind,
      accommodation_type:
        inferredKind === "accommodation" ? data.accommodationType : undefined,
      experience_type:
        inferredKind === "experience" ? data.experienceType : undefined,
      city: data.city,
      region: data.region,
      max_guests: inferredKind === "accommodation" ? data.maxGuests : undefined,
      duration_hours:
        inferredKind === "experience" ? data.durationHours : undefined,
      rate: Number((data.rate || "").replace(/\s/g, "")),
    });
    if (!parsed.success) {
      setErrors(zodIssuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    patch({ listingKind: inferredKind });
    advance();
  }

  function handlePlanNext() {
    // Any plan choice → free for now (payment wiring lands later).
    // Just advance to welcome where finalize runs.
    advance();
    startFinalize(async () => {
      const inferredKind: "accommodation" | "experience" =
        data.offering === "experiences" ? "experience" : "accommodation";
      const result = await finalizeOnboardingAction({
        full_name: data.fullName,
        phone: data.phone,
        country: data.country,
        bio: data.bio,
        languages: data.languages,
        offering: data.offering,
        listing_name: data.listingName,
        listing_kind: inferredKind,
        accommodation_type:
          inferredKind === "accommodation" ? data.accommodationType : undefined,
        experience_type:
          inferredKind === "experience" ? data.experienceType : undefined,
        city: data.city,
        region: data.region,
        max_guests:
          inferredKind === "accommodation" ? data.maxGuests : undefined,
        duration_hours:
          inferredKind === "experience" ? data.durationHours : undefined,
        rate: Number((data.rate || "").replace(/\s/g, "")),
        plan: data.plan,
        billing_cycle: data.billingCycle,
      });
      if (!result.ok) {
        toast.error(result.error);
      }
      // On success, the action redirects to /dashboard?welcome=1, so the
      // welcome step is briefly visible before the redirect lands.
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
      case "offer":
        advance();
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
      case "offer":
        return <StepOffer data={data} patch={patch} stepIndex={currentIndex} />;
      case "listing":
        return (
          <StepListing
            data={data}
            patch={patch}
            errors={errors}
            stepIndex={currentIndex}
          />
        );
      case "plan":
        return <StepPlan data={data} patch={patch} stepIndex={currentIndex} />;
      case "welcome":
        return <StepWelcome data={data} finalizePending={finalizePending} />;
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
  return (
    <div className="vilo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="A bit about you"
        subtitle="Guests see this on your public profile. A photo and short bio earn trust."
      />

      <div className="mt-7 space-y-5">
        {/* Avatar placeholder — upload wiring lands later */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-accent text-base font-semibold text-brand-secondary">
              {initials}
            </div>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "Photo upload is enabled from settings after onboarding.",
                )
              }
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line bg-white text-brand-ink shadow-card hover:bg-brand-accent"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-sm">
            <div className="font-medium text-brand-ink">Profile photo</div>
            <div className="mt-0.5 text-xs text-brand-mute">
              Square, at least 400×400. JPG or PNG.
            </div>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "Photo upload is enabled from settings after onboarding.",
                )
              }
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              <Upload className="h-3 w-3" /> Upload photo
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Phone number"
            hint="Used for booking-critical SMS only."
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

// ─── Step 3: What you offer ────────────────────────────────────────

function StepOffer({
  data,
  patch,
  stepIndex,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  stepIndex: number;
}) {
  const choices: {
    id: "accommodation" | "experiences" | "both";
    icon: typeof Home;
    title: string;
    desc: string;
  }[] = [
    {
      id: "accommodation",
      icon: Home,
      title: "Accommodation",
      desc: "Guesthouses, B&Bs, lodges, self-catering, hotels.",
    },
    {
      id: "experiences",
      icon: Compass,
      title: "Experiences",
      desc: "Tours, activities, classes, day trips.",
    },
    {
      id: "both",
      icon: Layers,
      title: "Both",
      desc: "I do both — let's set up accommodation first.",
    },
  ];
  return (
    <div className="vilo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="What are you offering?"
        subtitle="Don't worry — you can add experiences later if you start with accommodation, and vice versa."
      />

      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {choices.map((c) => {
          const on = data.offering === c.id;
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => patch({ offering: c.id })}
              className={`rounded-card border p-5 text-left transition-all hover:-translate-y-px ${
                on
                  ? "border-brand-primary bg-brand-accent/40 shadow-card"
                  : "border-brand-line bg-white hover:border-brand-primary/50"
              }`}
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${
                  on
                    ? "bg-brand-primary text-white"
                    : "bg-brand-accent text-brand-primary"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-brand-ink">
                  {c.title}
                </h3>
                {on ? (
                  <CheckCircle2 className="h-4 w-4 text-brand-primary" />
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                {c.desc}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-card border border-brand-line bg-brand-light/60 p-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
          <Info className="h-4 w-4" />
        </div>
        <div className="text-xs leading-relaxed text-brand-mute">
          Your choice changes which fields we ask for next. Accommodation asks
          for rooms &amp; rates. Experiences asks for duration &amp; price per
          person.
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: First listing ─────────────────────────────────────────

function StepListing({
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
  const isExperience = data.offering === "experiences";
  return (
    <div className="vilo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title={
          isExperience
            ? "Tell us about your first experience"
            : "Tell us about your first listing"
        }
        subtitle="The basics now. Photos, amenities, and pricing rules come in the full editor."
      />

      <div className="mt-7 space-y-5">
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

          <FormField label={isExperience ? "Experience type" : "Listing type"}>
            {isExperience ? (
              <SelectInput
                value={data.experienceType}
                onChange={(e) =>
                  patch({
                    experienceType: e.target
                      .value as WizardData["experienceType"],
                  })
                }
              >
                <option value="tour">Tour</option>
                <option value="activity">Activity</option>
                <option value="workshop">Class</option>
                <option value="transfer">Transfer</option>
                <option value="other">Other</option>
              </SelectInput>
            ) : (
              <SelectInput
                value={data.accommodationType}
                onChange={(e) =>
                  patch({
                    accommodationType: e.target
                      .value as WizardData["accommodationType"],
                  })
                }
              >
                <option value="guesthouse">Guesthouse</option>
                <option value="bb">B&amp;B</option>
                <option value="self_catering">Self-catering</option>
                <option value="lodge">Lodge</option>
                <option value="hotel">Hotel</option>
                <option value="cottage">Cottage</option>
                <option value="villa">Villa</option>
              </SelectInput>
            )}
          </FormField>

          <FormField label="City" error={errors.city}>
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

          {!isExperience ? (
            <>
              <FormField label="Max guests">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      patch({ maxGuests: Math.max(1, data.maxGuests - 1) })
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded border border-brand-line text-brand-ink hover:bg-brand-accent"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex-1 text-center font-display text-xl font-semibold text-brand-ink">
                    {data.maxGuests}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      patch({ maxGuests: Math.min(20, data.maxGuests + 1) })
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded border border-brand-line text-brand-ink hover:bg-brand-accent"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </FormField>

              <FormField
                label="Starting nightly rate"
                hint="ZAR. You can set weekend & seasonal overrides later."
                error={errors.rate}
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-mute">
                    R
                  </span>
                  <TextInput
                    value={data.rate}
                    onChange={(e) =>
                      patch({ rate: e.target.value.replace(/[^\d\s]/g, "") })
                    }
                    placeholder="1 200"
                    className="pl-8"
                    inputMode="numeric"
                  />
                </div>
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Duration (hours)">
                <TextInput
                  value={String(data.durationHours)}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    patch({
                      durationHours: Number.isFinite(n) ? n : 0,
                    });
                  }}
                  placeholder="3"
                  inputMode="decimal"
                />
              </FormField>
              <FormField
                label="Price per person"
                hint="ZAR."
                error={errors.rate}
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-mute">
                    R
                  </span>
                  <TextInput
                    value={data.rate}
                    onChange={(e) =>
                      patch({ rate: e.target.value.replace(/[^\d\s]/g, "") })
                    }
                    placeholder="450"
                    className="pl-8"
                    inputMode="numeric"
                  />
                </div>
              </FormField>
            </>
          )}
        </div>

        <FormField
          label="Cover photo"
          optional
          hint="One photo gets you live. Add up to 20 more later. (Upload lands after onboarding for now.)"
        >
          <button
            type="button"
            onClick={() => patch({ coverUploaded: !data.coverUploaded })}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed py-8 transition ${
              data.coverUploaded
                ? "border-brand-primary bg-brand-accent/30"
                : "border-brand-line bg-brand-light/40 hover:bg-brand-accent/30"
            }`}
          >
            {data.coverUploaded ? (
              <>
                <div className="flex h-24 w-40 items-center justify-center rounded-md bg-brand-accent/50 font-mono text-[11px] text-brand-secondary">
                  cover-photo.jpg
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary">
                  <CheckCircle2 className="h-4 w-4" /> Photo selected · click to
                  clear
                </div>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-pill border border-brand-line bg-white text-brand-primary">
                  <ImagePlus className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium text-brand-ink">
                  Drag &amp; drop or{" "}
                  <span className="text-brand-primary">browse</span>
                </div>
                <div className="text-xs text-brand-mute">
                  JPG or PNG · 16:9 recommended
                </div>
              </>
            )}
          </button>
        </FormField>
      </div>
    </div>
  );
}

// ─── Step 5: Subscription ──────────────────────────────────────────

function StepPlan({
  data,
  patch,
  stepIndex,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  stepIndex: number;
}) {
  const cycle = data.billingCycle;
  return (
    <div className="vilo-step-enter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <StepHeading
          stepIndex={stepIndex}
          title="Choose a plan"
          subtitle="Flat subscription — never a fee per booking. Cancel any time."
        />
        <div className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white p-1">
          <button
            type="button"
            onClick={() => patch({ billingCycle: "monthly" })}
            className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
              cycle === "monthly"
                ? "bg-brand-primary text-white"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => patch({ billingCycle: "annual" })}
            className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold transition ${
              cycle === "annual"
                ? "bg-brand-primary text-white"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            Annual
            <span
              className={`rounded-pill px-1.5 py-0 text-[10px] font-medium ${
                cycle === "annual"
                  ? "bg-white/20 text-white"
                  : "bg-brand-accent text-brand-primary"
              }`}
            >
              −2 mo
            </span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const on = data.plan === p.value;
          const price =
            cycle === "annual"
              ? p.annual === 0
                ? 0
                : Math.round(p.annual / 12)
              : p.monthly;
          const showStrike = cycle === "annual" && p.monthly > 0;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => patch({ plan: p.value })}
              className={`relative flex flex-col rounded-card border p-5 text-left transition-all hover:-translate-y-px ${
                on
                  ? "border-brand-primary bg-white shadow-glow"
                  : "border-brand-line bg-white hover:border-brand-primary/50"
              }`}
            >
              {p.tag ? (
                <span
                  className={`absolute -top-2 right-4 rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                    p.value === "pro"
                      ? "bg-brand-secondary text-white"
                      : "border border-brand-primary/30 bg-brand-accent text-brand-secondary"
                  }`}
                >
                  {p.tag}
                </span>
              ) : null}
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-bold text-brand-ink">
                  {p.name}
                </div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-pill border-2 ${
                    on
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line"
                  }`}
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                </div>
              </div>
              <p className="mt-1.5 min-h-[32px] text-xs text-brand-mute">
                {p.blurb}
              </p>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold text-brand-ink">
                  R{price.toLocaleString("en-ZA")}
                </span>
                <span className="text-xs text-brand-mute">
                  {p.value === "free" ? "" : "/month"}
                </span>
              </div>
              {showStrike ? (
                <div className="mt-0.5 text-[11px] text-brand-mute">
                  <span className="line-through">R{p.monthly}</span> billed
                  annually
                </div>
              ) : null}

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
                  on
                    ? "bg-brand-primary text-white"
                    : "border border-brand-line bg-brand-light text-brand-secondary"
                }`}
              >
                {on
                  ? "Selected"
                  : p.value === "free"
                    ? "Start with Free"
                    : "Start 14-day trial"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-card border border-brand-line bg-white p-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="text-xs leading-relaxed text-brand-mute">
          Billing isn&apos;t wired up yet, so every sign-up goes through on the
          free plan for now. You&apos;ll be able to upgrade from settings once
          payments ship — your data carries over.
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
}: {
  data: WizardData;
  finalizePending: boolean;
}) {
  const handle =
    (data.listingName || "my-listing")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "my-vilo";

  const checklist = [
    { id: 1, label: "Account created", done: true },
    { id: 2, label: "First listing added", done: true },
    { id: 3, label: "Add 5+ photos", done: false },
    { id: 4, label: "Set check-in / check-out times", done: false },
    { id: 5, label: "Connect Paystack to accept payments", done: false },
    { id: 6, label: "Publish your listing", done: false },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checklist.length) * 100);
  const [copied, setCopied] = useState(false);

  function copyHandle() {
    const url = `viloplatform.com/${handle}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Profile URL copied");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Couldn't copy — copy it manually."),
    );
  }

  return (
    <div className="vilo-step-enter relative">
      <Confetti />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-[11px] font-semibold text-brand-secondary">
          <PartyPopper className="h-3.5 w-3.5" />{" "}
          {finalizePending ? "Wrapping up…" : "You're in"}
        </div>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
          Welcome to Vilo, {(data.fullName || "host").split(" ")[0]}.
        </h2>
        <p className="mt-2 max-w-xl text-sm text-brand-mute md:text-base">
          Your <span className="font-medium text-brand-ink">Free</span> account
          is live. Here&apos;s everything you need to start taking direct
          bookings.
        </p>

        <div className="mt-6 rounded-card border border-brand-line bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Your public profile
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center font-mono text-base text-brand-ink md:text-lg">
              <span className="text-brand-mute">viloplatform.com/</span>
              <span className="font-semibold">{handle}</span>
            </div>
            <button
              type="button"
              onClick={copyHandle}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <Link
              href={`/${handle}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Preview
            </Link>
          </div>
          <div className="mt-3 text-xs text-brand-mute">
            Share this with anyone — your existing guests, your Instagram, your
            WhatsApp footer. Direct bookings are now possible.
          </div>
        </div>

        <div className="mt-4 rounded-card border border-brand-line bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-semibold text-brand-ink">
                Setup checklist
              </div>
              <div className="mt-0.5 text-xs text-brand-mute">
                {doneCount} of {checklist.length} complete
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-brand-primary">
                {pct}%
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-pill bg-brand-light">
            <div
              className="h-full bg-brand-primary transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 text-sm">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-pill ${
                    c.done
                      ? "bg-brand-primary text-white"
                      : "border border-brand-line bg-white text-brand-mute"
                  }`}
                >
                  {c.done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="h-1 w-1 rounded-pill bg-brand-mute" />
                  )}
                </div>
                <span
                  className={
                    c.done
                      ? "text-brand-ink line-through decoration-brand-line"
                      : "text-brand-ink"
                  }
                >
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                icon: ImagePlus,
                title: "Complete your listing",
                desc: "Add photos, amenities, pricing.",
                cta: "Open editor",
                href: "/dashboard/listings",
              },
              {
                icon: CreditCard,
                title: "Connect Paystack",
                desc: "Accept card payments instantly.",
                cta: "Connect",
                href: "/dashboard/settings",
              },
              {
                icon: BookOpen,
                title: "Read the host guide",
                desc: "6-min read · best-practice tips.",
                cta: "Open guide",
                href: "/help",
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.title}
                href={t.href}
                className="group rounded-card border border-brand-line bg-white p-4 transition hover:border-brand-primary/50 hover:shadow-card"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="font-display text-sm font-semibold text-brand-ink">
                  {t.title}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-brand-mute">
                  {t.desc}
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary transition-all group-hover:gap-2">
                  {t.cta} <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-brand-mute">
            <RotateCcw className="h-3.5 w-3.5" />
            We&apos;ll redirect you to the dashboard automatically.
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-secondary"
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
