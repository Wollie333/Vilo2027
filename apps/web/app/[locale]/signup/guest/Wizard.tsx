"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Eye,
  EyeOff,
  Loader2,
  Luggage,
  Mail,
  PartyPopper,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { combineName } from "@/lib/profile/name";

import {
  COUNTRIES,
  LANGUAGE_OPTIONS,
  SA_CITIES,
  accountSchema,
} from "./schemas";
import {
  createGuestAccountAction,
  finalizeGuestOnboardingAction,
  uploadAvatarAction,
} from "./actions";

// ─── Step machinery ───────────────────────────────────────────────

const STEPS = [
  { key: "account", label: "Account", short: "Account" },
  { key: "about", label: "About you", short: "Profile" },
  { key: "prefs", label: "Travel preferences", short: "Prefs" },
  { key: "welcome", label: "Welcome", short: "Done" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

type WizardData = {
  // Captured as two fields; fullName kept in sync (combined) for storage.
  firstName: string;
  surname: string;
  fullName: string;
  email: string;
  password: string;
  showPassword: boolean;
  terms: boolean;
  phone: string;
  country: string;
  bio: string;
  languages: string[];
  avatarUrl: string;
  preferredCities: string[];
  marketingOptIn: boolean;
};

function initialData(prefilledEmail: string | null): WizardData {
  return {
    firstName: "",
    surname: "",
    fullName: "",
    email: prefilledEmail ?? "",
    password: "",
    showPassword: false,
    terms: false,
    phone: "",
    country: "South Africa",
    bio: "",
    languages: ["English"],
    avatarUrl: "",
    preferredCities: [],
    marketingOptIn: false,
  };
}

const SIDE_RAIL: Record<
  StepKey,
  { eyebrow: string; title: string; body: string }
> = {
  account: {
    eyebrow: "Free forever",
    title: "Book direct. Pay direct.",
    body: "No booking fees. Talk to the host, not a middleman.",
  },
  about: {
    eyebrow: "Show up as you",
    title: "A face hosts can trust.",
    body: "Guests with a photo and a line of bio get faster instant-book replies from hosts.",
  },
  prefs: {
    eyebrow: "Tuned for you",
    title: "Stays you actually want.",
    body: "Tell us where you travel and we'll surface the right places at home and in your inbox.",
  },
  welcome: {
    eyebrow: "You're in",
    title: "Time to find your next stay.",
    body: "Browse direct-booking hosts, save what catches your eye, and message any host before you book.",
  },
};

const ERROR_KEY_MAP: Record<string, string> = {
  first_name: "firstName",
  surname: "surname",
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
  const brandName = useBrandName();
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
      first_name: data.firstName,
      surname: data.surname,
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
      const result = await createGuestAccountAction({
        first_name: data.firstName,
        surname: data.surname,
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

  function handlePrefsNext() {
    advance();
    startFinalize(async () => {
      const result = await finalizeGuestOnboardingAction({
        full_name: data.fullName,
        phone: data.phone,
        country: data.country,
        bio: data.bio,
        languages: data.languages,
        avatar_url: data.avatarUrl,
        preferred_cities: data.preferredCities,
        marketing_opt_in: data.marketingOptIn,
      });
      if (!result.ok) {
        toast.error(result.error);
      }
      // On success the action redirects to /portal?welcome=1.
    });
  }

  function onNext() {
    switch (current.key) {
      case "account":
        handleAccountNext();
        break;
      case "about":
        advance();
        break;
      case "prefs":
        handlePrefsNext();
        break;
    }
  }

  const nextLabel =
    current.key === "account"
      ? createPending
        ? "Creating account…"
        : "Create account"
      : current.key === "prefs"
        ? finalizePending
          ? "Setting up…"
          : "Finish & enter portal"
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
      case "prefs":
        return <StepPrefs data={data} patch={patch} stepIndex={currentIndex} />;
      case "welcome":
        return <StepWelcome data={data} finalizePending={finalizePending} />;
    }
  })();

  return (
    <div className="min-h-screen w-full bg-brand-light text-brand-ink">
      <div className="border-b border-brand-line bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <WieloMark size={28} />
            <div className="font-display font-bold text-brand-ink">
              {brandName}
            </div>
          </div>
          <Link
            href="/login"
            className="text-xs text-brand-mute hover:text-brand-ink"
          >
            Already have an account?{" "}
            <span className="font-medium text-brand-primary">Sign in</span>
          </Link>
        </div>
      </div>

      <div className="grid min-h-screen lg:grid-cols-[440px_1fr] xl:grid-cols-[520px_1fr]">
        <SideRail stepKey={current.key} current={currentIndex} />

        <div className="flex min-w-0 flex-col bg-white">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-brand-line bg-white/95 px-6 py-5 backdrop-blur lg:px-12 lg:py-6">
            <div className="min-w-0 flex-1">
              <Stepper current={currentIndex} onJump={jumpBack} />
            </div>
            <Link
              href="/login"
              className="hidden shrink-0 text-xs text-brand-mute hover:text-brand-ink lg:inline-flex"
            >
              Already have an account?{" "}
              <span className="ml-1 font-medium text-brand-primary">
                Sign in
              </span>
            </Link>
          </div>

          <div className="flex-1 px-6 py-10 lg:px-12 lg:py-14 xl:px-16">
            <div className="mx-auto w-full max-w-3xl">{stepBody}</div>
          </div>

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
                      href="/portal"
                      className="rounded border border-brand-line bg-white px-4 py-2 text-sm text-brand-ink transition hover:bg-white/90"
                    >
                      Skip for now
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
                By continuing, you agree to {brandName}&apos;s Terms of Service.
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
  const brandName = useBrandName();
  return (
    <aside className="relative flex flex-col overflow-hidden bg-brand-gradient-dark p-7 text-white lg:sticky lg:top-0 lg:h-screen lg:p-12 xl:p-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30"
      />
      <span className="wielo-orb wielo-orb-1" aria-hidden />
      <span className="wielo-orb wielo-orb-2" aria-hidden />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <WieloMark size={36} glow />
          <div>
            <div className="font-display font-bold leading-none">
              {brandName}
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-200/70">
              Guest onboarding
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

        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { v: "0%", l: "Booking fees" },
            { v: "12k+", l: "Properties" },
            { v: "4.9★", l: "Avg rating" },
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
        <span>© {brandName} 2026</span>
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
    <div className="wielo-hide-sb flex items-center gap-1 overflow-x-auto md:gap-3">
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
                      ? "wielo-ring-pulse border-2 border-brand-primary bg-white text-brand-primary"
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
  const brandName = useBrandName();
  return (
    <div className="wielo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title={`Create your ${brandName} account`}
        subtitle="Just the basics — you can edit everything from your profile later."
      />

      <div className="mt-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-brand-line" />
          <span className="text-[11px] uppercase tracking-wider text-brand-mute">
            Sign up with email
          </span>
          <div className="h-px flex-1 bg-brand-line" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name" error={errors.firstName}>
            <TextInput
              value={data.firstName}
              onChange={(e) =>
                patch({
                  firstName: e.target.value,
                  fullName: combineName(e.target.value, data.surname),
                })
              }
              placeholder="Nomvula"
              disabled={pending}
              autoComplete="given-name"
            />
          </FormField>
          <FormField label="Surname" error={errors.surname}>
            <TextInput
              value={data.surname}
              onChange={(e) =>
                patch({
                  surname: e.target.value,
                  fullName: combineName(data.firstName, e.target.value),
                })
              }
              placeholder="Khumalo"
              disabled={pending}
              autoComplete="family-name"
            />
          </FormField>
        </div>

        <FormField label="Email" error={errors.email}>
          <TextInput
            type="email"
            value={data.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="you@example.com"
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
              I agree to {brandName}&apos;s{" "}
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const initials =
    (data.fullName || "V")
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "V";

  function handleAvatarPick(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    uploadAvatarAction(fd)
      .then((result) => {
        if (result.ok && result.data) {
          patch({ avatarUrl: result.data.url });
          toast.success("Photo uploaded.");
        } else if (!result.ok) {
          toast.error(result.error);
        }
      })
      .finally(() => setUploading(false));
  }

  return (
    <div className="wielo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="A bit about you"
        subtitle="Hosts can see your name, photo and bio. None of this is required — skip what you like."
      />

      <div className="mt-7 space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-pill bg-brand-accent text-base font-semibold text-brand-secondary">
              {data.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.avatarUrl}
                  alt="Your avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line bg-white text-brand-ink shadow-card hover:bg-brand-accent"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="text-sm">
            <div className="font-medium text-brand-ink">Profile photo</div>
            <div className="mt-0.5 text-xs text-brand-mute">
              Square, at least 400×400. JPG or PNG, up to 5 MB.
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              <Upload className="h-3 w-3" />{" "}
              {data.avatarUrl ? "Replace photo" : "Upload photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarPick(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Phone number"
            optional
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

          <FormField label="Country" optional>
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
          hint="A sentence or two about you. Helps hosts feel they know who's arriving."
          error={errors.bio}
        >
          <TextAreaInput
            rows={3}
            value={data.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            placeholder="Slow traveller. Two kids, one dog. We love a long stoep breakfast."
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

// ─── Step 3: Travel preferences ───────────────────────────────────

function StepPrefs({
  data,
  patch,
  stepIndex,
}: {
  data: WizardData;
  patch: (p: Partial<WizardData>) => void;
  stepIndex: number;
}) {
  return (
    <div className="wielo-step-enter">
      <StepHeading
        stepIndex={stepIndex}
        title="Where do you want to go?"
        subtitle="Pick a few cities — we'll surface the right places at home and email you when great deals open up."
      />

      <div className="mt-7 space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-brand-ink">
              Preferred cities{" "}
              <span className="font-normal text-brand-mute">(optional)</span>
            </div>
            <div className="text-[11px] text-brand-mute">
              {data.preferredCities.length} selected
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {SA_CITIES.map((city) => {
              const on = data.preferredCities.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() =>
                    patch({
                      preferredCities: on
                        ? data.preferredCities.filter((c) => c !== city)
                        : [...data.preferredCities, city],
                    })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line bg-white text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
                  }`}
                >
                  {on ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  {city}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-card border border-brand-line bg-white p-5">
          <label className="flex cursor-pointer items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-brand-ink">
                Send me marketing emails
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                Featured stays, host stories, and deals in the places you
                marked. Maximum one email a week — unsubscribe any time.
              </p>
            </div>
            <input
              type="checkbox"
              checked={data.marketingOptIn}
              onChange={(e) => patch({ marketingOptIn: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
            />
          </label>
        </div>

        <div className="flex items-start gap-3 rounded-card border border-brand-line bg-brand-light/60 p-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-xs leading-relaxed text-brand-mute">
            You can change any of this later from{" "}
            <span className="font-medium text-brand-ink">
              /portal → Settings
            </span>
            . Marketing emails default to off — you have to tick the box.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Welcome ──────────────────────────────────────────────

function StepWelcome({
  data,
  finalizePending,
}: {
  data: WizardData;
  finalizePending: boolean;
}) {
  const brandName = useBrandName();
  return (
    <div className="wielo-step-enter">
      <div className="inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-[11px] font-semibold text-brand-secondary">
        <PartyPopper className="h-3.5 w-3.5" />{" "}
        {finalizePending ? "Wrapping up…" : "You're in"}
      </div>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
        Welcome to {brandName}, {(data.fullName || "guest").split(" ")[0]}.
      </h2>
      <p className="mt-2 max-w-xl text-sm text-brand-mute md:text-base">
        Your account is live. From here you can book direct stays, message
        hosts, and manage every trip in one place.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(
          [
            {
              icon: Compass,
              title: "Find your next stay",
              desc: "Browse direct-booking hosts across South Africa.",
              cta: "Explore",
              href: "/explore",
            },
            {
              icon: Luggage,
              title: "Your trips",
              desc: "Upcoming and past bookings live in /portal/trips.",
              cta: "Open portal",
              href: "/portal",
            },
            {
              icon: BookOpen,
              title: "How Wielo works",
              desc: "A 3-minute primer on booking, payments and reviews.",
              cta: "Read guide",
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
                {t.title.replace("Wielo", brandName)}
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
          <Mail className="h-3.5 w-3.5" /> We&apos;ll redirect you to your
          portal automatically.
        </div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 rounded bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-secondary"
        >
          Go to portal <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Tiny form atoms (shared with host wizard's aesthetic) ────────

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

function WieloMark({
  size = 36,
  glow = false,
}: {
  size?: number;
  glow?: boolean;
}) {
  const id = useMemo(
    () => `wielo-grad-${Math.random().toString(36).slice(2, 8)}`,
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
