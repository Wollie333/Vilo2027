import {
  ArrowRight,
  Banknote,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Home as HomeIcon,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { type SetupStep, setupProgress } from "./setupSteps";
import { TourButton } from "./tour/TourButton";

const STEP_ICON: Record<string, typeof Mail> = {
  email_verified: Mail,
  profile_completed: UserRound,
  first_listing: HomeIcon,
  paystack_verified: CreditCard,
  policies_set: ShieldCheck,
  listing_published: Rocket,
};

export function OnboardingDashboard({
  brandName,
  firstName,
  handle,
  steps,
}: {
  brandName: string;
  firstName: string;
  handle: string | null;
  steps: SetupStep[];
}) {
  const { total, done, pct, nextStep } = setupProgress(steps);
  const RING = 326.726; // 2π·52
  const offset = RING * (1 - pct / 100);

  return (
    <div className="w-full">
      {/* sub-header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-[18px] font-extrabold leading-none text-brand-ink">
            Welcome, {firstName}
          </h1>
          <div className="mt-1.5 text-[12.5px] text-brand-mute">
            Let&rsquo;s get your place ready for guests
          </div>
        </div>
        {handle ? (
          <Link
            href={`/${handle}`}
            target="_blank"
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <ExternalLink className="h-4 w-4 text-brand-mute" /> Preview page
          </Link>
        ) : null}
      </div>

      {/* welcome + progress */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="grid md:grid-cols-[1.5fr_1fr]">
          <div className="p-6 lg:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 text-[10.5px] font-semibold text-brand-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" /> New
              account
            </span>
            <h2 className="mt-3.5 font-display text-[28px] font-extrabold leading-[1.1] tracking-tight text-brand-ink lg:text-[32px]">
              Welcome to {brandName}, {firstName}.
            </h2>
            <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-brand-mute">
              Your direct-booking page is reserved. Finish a few quick steps and
              you&rsquo;ll be ready to take guests — no commission, paid
              straight to you.
            </p>

            {handle ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-pill border border-brand-line bg-brand-light px-3.5 py-2 text-[12.5px]">
                <LinkIcon className="h-3.5 w-3.5 text-brand-primary" />
                <span className="font-mono text-brand-mute">
                  wieloplatform.com/
                </span>
                <span className="font-mono font-semibold text-brand-ink">
                  {handle}
                </span>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href={nextStep?.href ?? "/dashboard/setup"}
                className="inline-flex h-11 items-center gap-1.5 rounded-pill bg-brand-primary px-5 text-[14px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(16,185,129,.7)] transition hover:bg-brand-secondary"
              >
                Finish setting up <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/help"
                className="inline-flex h-11 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 text-[14px] font-medium text-brand-ink transition hover:bg-brand-light"
              >
                <BookOpen className="h-4 w-4 text-brand-primary" /> Host guide
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 border-t border-brand-line bg-[#FAFCFB] p-6 md:border-l md:border-t-0 lg:p-8">
            <div className="relative h-[116px] w-[116px] shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#E4EFE8"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-display text-[26px] font-extrabold leading-none text-brand-ink">
                  {done}
                  <span className="text-[18px] text-brand-mute">/{total}</span>
                </div>
                <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-wider text-brand-mute">
                  steps done
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Up next
              </div>
              <div className="mt-1 font-display text-[15px] font-bold text-brand-ink">
                {nextStep?.title ?? "You're all set"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* main grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* checklist */}
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-4 lg:px-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Get set up
              </div>
              <div className="mt-1 font-display text-[17px] font-bold text-brand-ink">
                {total} steps before you go live
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
              {done} done
            </span>
          </div>
          <ul className="px-5 pb-2 lg:px-6">
            {steps.map((s) => {
              const isNext = nextStep?.key === s.key;
              const Icon = s.done ? Check : (STEP_ICON[s.key] ?? UserRound);
              const state = s.done ? "done" : isNext ? "current" : "todo";
              return (
                <li
                  key={s.key}
                  className="flex items-center gap-4 border-t border-[#F1F6F2] py-[15px] first:border-t-0"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      state === "done"
                        ? "bg-brand-primary text-white"
                        : state === "current"
                          ? "border-2 border-brand-primary bg-emerald-50 text-brand-secondary"
                          : "border-2 border-dashed border-[#CFE2D6] text-[#94AEA2]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-[14px] font-semibold ${state === "done" ? "text-brand-mute line-through decoration-[#CFE2D6]" : "text-brand-ink"}`}
                      >
                        {s.title}
                      </div>
                      {isNext ? (
                        <span className="rounded-pill bg-status-pending/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-pending">
                          Next
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[12px] text-brand-mute">
                      {s.meta || s.description}
                    </div>
                  </div>
                  {s.done ? (
                    <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                      Done
                    </span>
                  ) : (
                    <Link
                      href={s.href}
                      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-pill px-4 text-[12.5px] font-semibold transition ${
                        isNext
                          ? "bg-brand-primary text-white hover:bg-brand-secondary"
                          : "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                      }`}
                    >
                      {s.ctaLabel}
                      {isNext ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* side */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Once you&rsquo;re live
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-brand-line">
              <LivePreview icon={Banknote} label="Revenue" value="R 0" />
              <LivePreview icon={CalendarCheck} label="Bookings" value="0" />
              <LivePreview icon={BarChart3} label="Occupancy" value="—" />
              <LivePreview icon={Star} label="Rating" value="—" />
            </div>
            <div className="px-5 py-3 text-[12px] text-brand-mute">
              Your numbers start filling in the moment your first booking lands.
            </div>
          </section>

          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                A hand to get going
              </div>
            </div>
            <div className="p-2">
              <TourButton variant="row" />
              <SupportLink
                href="/dashboard/help"
                icon={BookOpen}
                title="Host starter guide"
                sub="Pricing, photos & policies that convert"
              />
              <SupportLink
                href="/dashboard/inbox"
                icon={MessageCircle}
                title="Chat with our team"
                sub="A real human replies within a day"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function LivePreview({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white p-4">
      <div className="flex items-center gap-1.5 text-brand-mute">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 font-display text-[18px] font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}

function SupportLink({
  href,
  icon: Icon,
  title,
  sub,
}: {
  href: string;
  icon: typeof BookOpen;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition hover:bg-brand-light"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-secondary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-brand-ink">
          {title}
        </span>
        <span className="block text-[11.5px] text-brand-mute">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-brand-mute" />
    </Link>
  );
}
