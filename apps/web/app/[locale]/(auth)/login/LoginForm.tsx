"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Key,
  Lock,
  Luggage,
  Mail,
  ShieldCheck,
  Star,
  WandSparkles,
} from "lucide-react";
import { VLogo } from "@/app/_components/home/VLogo";
import { Link } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BrandName, useCompanyName } from "@/components/brand/BrandProvider";

import { loginAction, magicLinkAction } from "../actions";

export function LoginForm({
  justRegistered,
  next,
  defaultEmail = "",
}: {
  justRegistered: boolean;
  next?: string | null;
  defaultEmail?: string;
}) {
  const [magicMode, setMagicMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitLabel = isPending
    ? magicMode
      ? "Sending link…"
      : "Signing in…"
    : magicMode
      ? "Send me a magic link"
      : "Sign in";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailErr(null);
    setPasswordErr(null);

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailErr("Enter a valid email.");
      return;
    }

    if (magicMode) {
      startTransition(async () => {
        const result = await magicLinkAction({ email: trimmed });
        if (result && !result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("If an account exists, the link is on its way.");
      });
      return;
    }

    if (password.length < 1) {
      setPasswordErr("Enter your password.");
      return;
    }

    startTransition(async () => {
      const result = await loginAction(
        { email: trimmed, password },
        next ?? null,
      );
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.05fr_1fr]">
      <Showcase />

      <main className="relative flex min-w-0 items-stretch justify-center bg-brand-light/50 p-6 lg:items-center lg:p-10 xl:p-12">
        <div className="absolute right-5 top-5 flex items-center gap-2 lg:right-8 lg:top-7">
          <button
            type="button"
            onClick={() => toast.info("Language switcher coming soon.")}
            className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-xs text-brand-mute hover:text-brand-ink"
          >
            <Globe className="h-3.5 w-3.5" /> EN{" "}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <div className="w-full max-w-[440px] py-10 lg:py-0">
          <div className="wielo-fade-up">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
              Welcome back
            </div>
            <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-tight text-brand-ink sm:text-[36px]">
              Sign in to <BrandName />
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-brand-mute">
              Pick up where you left off — bookings, messages and saved stays.
            </p>
          </div>

          {justRegistered ? (
            <div className="wielo-fade-up wielo-delay-1 mt-5 rounded border border-brand-line bg-brand-accent/60 px-4 py-3 text-sm text-brand-ink">
              Check your inbox to verify your email, then sign in below.
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="wielo-fade-up wielo-delay-2 mt-7 space-y-3.5"
            noValidate
          >
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-[11px] font-semibold text-brand-ink"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailErr) setEmailErr(null);
                  }}
                  disabled={isPending}
                  placeholder="you@example.com"
                  className="w-full rounded-[10px] border-[1.5px] border-brand-line bg-white py-3 pl-11 pr-3 text-[14.5px] text-brand-ink placeholder:text-[#A6BFB1] focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                />
              </div>
              {emailErr ? (
                <div className="mt-1.5 text-[11px] text-red-600">
                  {emailErr}
                </div>
              ) : null}
            </div>

            {!magicMode ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="text-[11px] font-semibold text-brand-ink"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-medium text-brand-primary hover:text-brand-secondary"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required={!magicMode}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordErr) setPasswordErr(null);
                    }}
                    disabled={isPending}
                    placeholder="••••••••••"
                    className="w-full rounded-[10px] border-[1.5px] border-brand-line bg-white py-3 pl-11 pr-11 text-[14.5px] text-brand-ink placeholder:text-[#A6BFB1] focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-brand-mute hover:text-brand-ink"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordErr ? (
                  <div className="mt-1.5 text-[11px] text-red-600">
                    {passwordErr}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!magicMode ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-brand-ink">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                  />
                  Remember me for 30 days
                </label>
                <button
                  type="button"
                  onClick={() => setMagicMode(true)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-primary hover:text-brand-secondary"
                >
                  <WandSparkles className="h-3.5 w-3.5" /> Use a magic link
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-[11.5px] text-brand-mute">
                  We&apos;ll email a one-time sign-in link to existing accounts.
                </div>
                <button
                  type="button"
                  onClick={() => setMagicMode(false)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-primary hover:text-brand-secondary"
                >
                  <Key className="h-3.5 w-3.5" /> Use a password instead
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-4 py-3 text-[14.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
            >
              <span>{submitLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-center gap-1.5 pt-3 text-[12.5px] text-brand-mute">
              <Key className="h-3.5 w-3.5 text-brand-primary" />
              <span>Forgot your password?</span>
              <Link
                href="/forgot-password"
                className="font-semibold text-brand-primary hover:text-brand-secondary"
              >
                Reset it here
              </Link>
            </div>
          </form>

          <div className="wielo-fade-up wielo-delay-3 mt-7 border-t border-brand-line pt-6 text-center text-[13px] text-brand-mute">
            New to <BrandName />?
            <Link
              href="/signup"
              className="ml-1 font-semibold text-brand-ink underline decoration-brand-line underline-offset-4 hover:text-brand-primary"
            >
              Create an account
            </Link>
          </div>

          <div className="wielo-fade-up wielo-delay-3 mt-6 flex items-center justify-center gap-5 text-[10.5px] text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" /> 256-bit
              TLS
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-brand-primary" /> PCI-DSS
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" /> POPIA
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function Showcase() {
  const companyName = useCompanyName();
  return (
    <aside className="relative hidden min-h-[260px] flex-col overflow-hidden bg-brand-gradient-dark p-8 text-white lg:flex lg:min-h-0 lg:p-14 xl:p-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-25"
      />
      <span className="wielo-orb wielo-orb-1" aria-hidden />
      <span className="wielo-orb wielo-orb-2" aria-hidden />
      <span className="wielo-orb wielo-orb-3" aria-hidden />

      <div className="relative flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <VLogo
            size={40}
            gradientId="login-logo"
            className="wielo-logo-pulse"
          />
          <div className="leading-none">
            <div className="font-display text-[19px] font-bold tracking-tight">
              <BrandName />
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-300/80">
              Direct booking platform
            </div>
          </div>
        </Link>
        <Link
          href="/"
          className="hidden items-center gap-1.5 text-[12px] text-emerald-200/70 transition-colors hover:text-white lg:inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to homepage
        </Link>
      </div>

      <div className="relative flex max-w-md flex-1 flex-col justify-center py-8 lg:py-12">
        <div className="inline-flex items-center gap-1.5 self-start rounded-pill bg-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/95 ring-1 ring-white/15 backdrop-blur-sm">
          <Luggage className="h-3 w-3" /> Welcome back
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold leading-[1.1] tracking-tight lg:text-4xl xl:text-[44px]">
          Direct stays. Direct hosts.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-emerald-100/75">
          One login for everything you do on <BrandName /> — your trips,
          messages, listings, payouts.
        </p>
      </div>

      <div className="relative">
        <div className="rounded-card border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-1 text-amber-300">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-current" />
            ))}
          </div>
          <p className="text-[14.5px] leading-relaxed text-emerald-50/95">
            &ldquo;The outdoor bath under the Milky Way is what dreams are made
            of. Lerato thought of every small thing.&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/30 ring-2 ring-white/20">
              <Luggage className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Nomvula K.</div>
              <div className="text-[11px] text-emerald-200/70">
                Karoo Cottage · 3-night stay
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { v: "12k+", l: "Properties" },
            { v: "0%", l: "Booking fee" },
            { v: "4.9★", l: "Avg rating" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-card border border-white/10 bg-white/[0.04] p-3 text-center"
            >
              <div className="font-display text-xl font-bold text-white">
                {s.v}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-emerald-200/70">
                {s.l}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between text-[11px] text-emerald-200/55">
          <div>
            © {new Date().getFullYear()} {companyName}
          </div>
          <div className="flex gap-4">
            <Link href="/status" className="hover:text-white">
              Status
            </Link>
            <Link href="/help" className="hover:text-white">
              Help
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
