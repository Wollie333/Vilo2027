"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Home,
  Key,
  Lock,
  Luggage,
  Mail,
  Shield,
  ShieldCheck,
  Star,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { loginAction, magicLinkAction } from "../actions";

type Role = "guest" | "host" | "admin";

type Showcase = {
  eyebrow: string;
  title: string;
  sub: string;
  heroIcon: typeof Luggage;
  formHeading: string;
  formSub: string;
  submit: string;
  signupLabel: string;
  signupCta: string;
  signupHref: string;
};

const SHOWCASE: Record<Role, Showcase> = {
  guest: {
    eyebrow: "For travellers",
    title: "Welcome back to your stays.",
    sub: "Pick up trips, messages and saved stays — same login as before.",
    heroIcon: Luggage,
    formHeading: "Sign in to Vilo",
    formSub:
      "Pick up where you left off — booking history, saved stays and conversations.",
    submit: "Sign in",
    signupLabel: "New to Vilo?",
    signupCta: "Create an account",
    signupHref: "/register",
  },
  host: {
    eyebrow: "For hosts",
    title: "Welcome back, host.",
    sub: "Bookings, channels and your direct guest inbox — all waiting.",
    heroIcon: Home,
    formHeading: "Sign in to your host dashboard",
    formSub: "Manage bookings, listings, payouts and your direct guest inbox.",
    submit: "Open dashboard",
    signupLabel: "Don't have a host account?",
    signupCta: "List your property",
    signupHref: "/signup/host",
  },
  admin: {
    eyebrow: "Vilo internal",
    title: "Vilo admin console.",
    sub: "Restricted to authorised employees. SSO + authenticator required.",
    heroIcon: ShieldCheck,
    formHeading: "Sign in to the admin console",
    formSub: "Vilo employees only. SSO via your Vilo Workspace account.",
    submit: "Continue with SSO",
    signupLabel: "Need access?",
    signupCta: "Request from IT",
    signupHref: "#",
  },
};

export function LoginForm({
  justRegistered,
  next,
}: {
  justRegistered: boolean;
  next?: string | null;
}) {
  const [role, setRole] = useState<Role>("guest");
  const [magicMode, setMagicMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showcase = SHOWCASE[role];
  const isAdmin = role === "admin";

  const submitLabel = useMemo(() => {
    if (isPending) {
      return magicMode ? "Sending link…" : "Signing in…";
    }
    if (magicMode) return "Send me a magic link";
    return showcase.submit;
  }, [isPending, magicMode, showcase]);

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
      <Showcase role={role} />

      <main className="relative flex min-w-0 items-stretch justify-center bg-brand-light/50 p-6 lg:items-center lg:p-10 xl:p-12">
        {/* Language picker */}
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
          {/* Header */}
          <div className="vilo-fade-up">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
              Welcome back
            </div>
            <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-tight text-brand-ink sm:text-[36px]">
              {showcase.formHeading}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-brand-mute">
              {showcase.formSub}
            </p>
          </div>

          {justRegistered ? (
            <div className="vilo-fade-up vilo-delay-1 mt-5 rounded border border-brand-line bg-brand-accent/60 px-4 py-3 text-sm text-brand-ink">
              Check your inbox to verify your email, then sign in below.
            </div>
          ) : null}

          {/* Role tabs */}
          <div className="vilo-fade-up vilo-delay-1 mt-7">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              I&apos;m signing in as
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-pill border border-brand-line bg-white p-1">
              <RoleTab
                active={role === "guest"}
                onClick={() => setRole("guest")}
              >
                <Luggage className="h-3.5 w-3.5" /> Guest
              </RoleTab>
              <RoleTab active={role === "host"} onClick={() => setRole("host")}>
                <Home className="h-3.5 w-3.5" /> Host
              </RoleTab>
              <RoleTab
                active={role === "admin"}
                onClick={() => setRole("admin")}
                dark
              >
                <Shield className="h-3.5 w-3.5" /> Admin
              </RoleTab>
            </div>
          </div>

          {/* Admin notice */}
          {isAdmin ? (
            <div className="vilo-fade-up mt-4 flex items-start gap-2.5 rounded-card border border-brand-ink/15 bg-brand-ink p-3.5 text-emerald-100/95">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <div className="text-[12px] leading-relaxed">
                <span className="font-semibold text-white">
                  Restricted access.
                </span>{" "}
                Admin sign-in requires SSO and an authenticator code. All
                actions are logged.
              </div>
            </div>
          ) : null}

          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            className="vilo-fade-up vilo-delay-2 mt-6 space-y-3.5"
            noValidate
          >
            {/* Email */}
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

            {/* Password (hidden in magic mode) */}
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

            {/* Admin TOTP — visual only; submit doesn't read this in MVP */}
            {isAdmin ? (
              <div>
                <label
                  htmlFor="login-totp"
                  className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-ink"
                >
                  <Key className="h-3.5 w-3.5 text-brand-primary" />{" "}
                  Authenticator code
                </label>
                <input
                  id="login-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000 000"
                  className="w-full rounded-[10px] border-[1.5px] border-brand-line bg-white py-3 pl-3.5 pr-3 font-mono text-[14.5px] tracking-[0.4em] text-brand-ink placeholder:text-[#A6BFB1] focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                />
                <div className="mt-1.5 text-[11px] text-brand-mute">
                  6-digit code from your authenticator app.
                </div>
              </div>
            ) : null}

            {/* Remember + magic-link toggle */}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              data-role={role}
              className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-[14.5px] font-semibold text-white transition disabled:opacity-60 ${
                isAdmin
                  ? "bg-brand-dark hover:bg-brand-ink"
                  : "bg-brand-primary hover:bg-brand-secondary"
              }`}
            >
              <span>{submitLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 pt-3">
              <span className="h-px flex-1 bg-brand-line" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Or continue with
              </span>
              <span className="h-px flex-1 bg-brand-line" />
            </div>

            {isAdmin ? (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Vilo SSO will be wired up before launch.")
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] bg-white px-4 py-2.5 text-[13.5px] font-medium hover:bg-brand-light/60"
                  style={{ borderColor: "#0A1510", color: "#0A1510" }}
                >
                  <Key className="h-4 w-4" /> Continue with Vilo SSO
                </button>
                <div className="mt-2 text-center text-[11px] text-brand-mute">
                  Admins must sign in via Vilo SSO. Your IT team manages access.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <OAuthOutlineButton
                  label="Google"
                  onClick={() =>
                    toast.info("OAuth providers are not enabled yet.")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.61 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.69 14.97.62 12 .62 7.39.62 3.4 3.27 1.46 7.13l3.67 2.85C6.06 7.07 8.79 5.04 12 5.04z"
                    />
                    <path
                      fill="#34A853"
                      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.45-1.13 2.68-2.41 3.51l3.69 2.85c2.16-2 3.74-4.94 3.74-8.6z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.13 14.27a7.21 7.21 0 0 1-.38-2.27c0-.79.14-1.55.38-2.27L1.46 6.88A11.36 11.36 0 0 0 .25 12c0 1.84.44 3.57 1.21 5.12l3.67-2.85z"
                    />
                    <path
                      fill="#4285F4"
                      d="M12 23.38c3.24 0 5.95-1.07 7.93-2.91l-3.69-2.85c-1.02.68-2.33 1.08-4.24 1.08-3.21 0-5.94-2.03-6.87-4.94l-3.67 2.85C3.4 20.73 7.39 23.38 12 23.38z"
                    />
                  </svg>
                </OAuthOutlineButton>
                <OAuthOutlineButton
                  label="Apple"
                  onClick={() =>
                    toast.info("OAuth providers are not enabled yet.")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M17.05 12.04c-.03-2.62 2.14-3.88 2.24-3.94-1.22-1.78-3.12-2.03-3.8-2.06-1.62-.17-3.16.96-3.99.96-.83 0-2.1-.93-3.46-.9C6.27 6.13 4.66 7.13 3.78 8.7c-1.88 3.27-.48 8.1 1.36 10.75.9 1.3 1.97 2.75 3.37 2.7 1.36-.06 1.87-.88 3.51-.88 1.64 0 2.1.88 3.54.85 1.46-.02 2.39-1.32 3.28-2.63 1.04-1.5 1.46-2.97 1.48-3.05-.03-.01-2.85-1.1-2.88-4.36zm-2.7-8.06c.74-.9 1.24-2.14 1.1-3.38-1.06.04-2.36.71-3.13 1.6-.69.79-1.3 2.06-1.14 3.27 1.19.09 2.42-.6 3.17-1.49z" />
                  </svg>
                </OAuthOutlineButton>
              </div>
            )}
          </form>

          {/* Sign-up CTA */}
          <div className="vilo-fade-up vilo-delay-3 mt-7 border-t border-brand-line pt-6 text-center text-[13px] text-brand-mute">
            {showcase.signupLabel}{" "}
            <Link
              href={showcase.signupHref}
              className="ml-1 font-semibold text-brand-ink underline decoration-brand-line underline-offset-4 hover:text-brand-primary"
            >
              {showcase.signupCta}
            </Link>
          </div>

          {/* Trust strip */}
          <div className="vilo-fade-up vilo-delay-3 mt-6 flex items-center justify-center gap-5 text-[10.5px] text-brand-mute">
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

function RoleTab({
  active,
  onClick,
  dark,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2 py-2 text-[12.5px] font-semibold transition ${
        active
          ? dark
            ? "bg-brand-dark text-white shadow-card"
            : "bg-white text-brand-ink shadow-card"
          : "bg-transparent text-brand-mute hover:text-brand-ink"
      }`}
    >
      {children}
    </button>
  );
}

function OAuthOutlineButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-brand-line bg-white px-4 py-2.5 text-[13.5px] font-medium text-brand-ink transition hover:border-brand-primary hover:bg-brand-light/60"
    >
      {children}
      {label}
    </button>
  );
}

function Showcase({ role }: { role: Role }) {
  const r = SHOWCASE[role];
  const HeroIcon = r.heroIcon;
  return (
    <aside className="relative flex min-h-[260px] flex-col overflow-hidden bg-brand-gradient-dark p-8 text-white lg:min-h-0 lg:p-14 xl:p-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-25"
      />
      <span className="vilo-orb vilo-orb-1" aria-hidden />
      <span className="vilo-orb vilo-orb-2" aria-hidden />
      <span className="vilo-orb vilo-orb-3" aria-hidden />

      {/* Logo + back */}
      <div className="relative flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <svg
            className="vilo-logo-pulse h-10 w-10 rounded-md"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="login-logoG"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#064E3B" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="22" fill="url(#login-logoG)" />
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
          <div className="leading-none">
            <div className="font-display text-[19px] font-bold tracking-tight">
              Vilo
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

      {/* Hero copy */}
      <div className="relative flex max-w-md flex-1 flex-col justify-center py-8 lg:py-12">
        <div className="inline-flex items-center gap-1.5 self-start rounded-pill bg-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/95 ring-1 ring-white/15 backdrop-blur-sm">
          <HeroIcon className="h-3 w-3" /> {r.eyebrow}
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold leading-[1.1] tracking-tight lg:text-4xl xl:text-[44px]">
          {r.title}
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-emerald-100/75">
          {r.sub}
        </p>
      </div>

      {/* Proof */}
      <div className="relative">
        <ProofCard role={role} />
        <div className="mt-8 flex items-center justify-between text-[11px] text-emerald-200/55">
          <div>© 2026 Vilo Platform (Pty) Ltd</div>
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

function ProofCard({ role }: { role: Role }) {
  if (role === "host") {
    return (
      <>
        <div className="relative overflow-hidden rounded-card border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
          <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="relative">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Sample payout
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-white">
              R 47 320
            </div>
            <div className="mt-1 text-[11px] text-emerald-200/70">
              12 bookings · 0% commission
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/30 ring-2 ring-white/20">
              <Home className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">
                Direct guest payments
              </div>
              <div className="text-[11px] text-emerald-200/70">
                Paid into your account, not held by Vilo
              </div>
            </div>
          </div>
        </div>
        <ProofStats
          stats={[
            { v: "1.2k+", l: "SA hosts" },
            { v: "R 49", l: "Flat / month" },
            { v: "24h", l: "Avg payout" },
          ]}
        />
      </>
    );
  }

  if (role === "admin") {
    return (
      <>
        <div className="rounded-card border border-amber-400/30 bg-amber-500/10 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber-400/20 text-amber-200">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-sm font-semibold text-white">
                Sensitive systems
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-amber-100/85">
                Admin actions affect production data. All sign-ins, role changes
                and refunds are written to the audit log.
              </p>
            </div>
          </div>
        </div>
        <ul className="mt-5 space-y-2 text-[12px] text-emerald-100/85">
          {[
            "Vilo Workspace SSO required",
            "Authenticator code on every sign-in",
            "Session expires after 30 minutes",
            "IP allow-list enforced",
          ].map((s) => (
            <li key={s} className="flex items-center gap-2">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" /> {s}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
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
      <ProofStats
        stats={[
          { v: "12k+", l: "Properties" },
          { v: "0%", l: "Booking fee" },
          { v: "4.9★", l: "Avg rating" },
        ]}
      />
    </>
  );
}

function ProofStats({ stats }: { stats: { v: string; l: string }[] }) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <div
          key={s.l}
          className="rounded-card border border-white/10 bg-white/[0.04] p-3 text-center"
        >
          <div className="font-display text-xl font-bold text-white">{s.v}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-emerald-200/70">
            {s.l}
          </div>
        </div>
      ))}
    </div>
  );
}
