"use client";

import {
  ArrowRight,
  BarChart3,
  CalendarSync,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Inbox,
  LayoutGrid,
  type LucideIcon,
  MessagesSquare,
  Receipt,
  ShieldCheck,
  Star,
  Tags,
  UserRound,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { useBrandName } from "@/components/brand/BrandProvider";
import type { CatalogProduct } from "@/lib/products/getProducts";

type Props = {
  plans: CatalogProduct[];
};

const DARK_GRADIENT =
  "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)";

// One zero-based count of how many slides the deck renders. Kept in sync with
// the `slides` array built in render — the deck owns navigation state here so
// the page can stay a Server Component that only fetches live data.
function formatPrice(plan: CatalogProduct): string {
  if (plan.isFree) return "R0";
  const n = plan.price.toLocaleString("en-ZA");
  return plan.currency === "ZAR" ? `R${n}` : `${plan.currency} ${n}`;
}

// Ordered by host pain point — the deepest pains (commission, losing the guest,
// tool sprawl) lead so the slide reads as a benefit-driven solution list.
const FEATURES: Array<{ icon: LucideIcon; key: string }> = [
  { icon: CreditCard, key: "featPayments" },
  { icon: Inbox, key: "featInbox" },
  { icon: Receipt, key: "featBookings" },
  { icon: CalendarSync, key: "featCalendar" },
  { icon: LayoutGrid, key: "featListings" },
  { icon: Star, key: "featReviews" },
  { icon: Tags, key: "featPricing" },
  { icon: BarChart3, key: "featReports" },
];

export function PitchDeck({ plans }: Props) {
  const t = useTranslations("pitch");
  const brand = useBrandName();

  const slides = [
    <TitleSlide key="title" brand={brand} t={t} />,
    <ProblemSlide key="problem" t={t} />,
    <SolutionSlide key="solution" t={t} />,
    <MoneySlide key="money" brand={brand} t={t} />,
    <GuestSlide key="guest" t={t} />,
    <FeaturesSlide key="features" t={t} />,
    <PricingSlide key="pricing" plans={plans} t={t} />,
    <WhyNowSlide key="whynow" t={t} />,
    <CtaSlide key="cta" t={t} />,
  ];
  const total = slides.length;

  const [current, setCurrent] = useState(0);

  const go = useCallback(
    (dir: 1 | -1) =>
      setCurrent((c) => Math.min(total - 1, Math.max(0, c + dir))),
    [total],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          go(-1);
          break;
        case "Home":
          e.preventDefault();
          setCurrent(0);
          break;
        case "End":
          e.preventDefault();
          setCurrent(total - 1);
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-brand-dark text-white">
      {slides[current]}

      {/* Click zones: left third = back, right two-thirds = forward */}
      <button
        type="button"
        aria-label={t("prev")}
        onClick={() => go(-1)}
        disabled={current === 0}
        className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize disabled:cursor-default"
      />
      <button
        type="button"
        aria-label={t("next")}
        onClick={() => go(1)}
        disabled={current === total - 1}
        className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-e-resize disabled:cursor-default"
      />

      {/* Controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-6 pb-6 lg:px-10 lg:pb-8">
        <span className="rounded-pill bg-white/10 px-3 py-1 font-mono text-xs text-white/70 backdrop-blur">
          {t("slideCount", { current: current + 1, total })}
        </span>
        <span className="hidden text-[11px] uppercase tracking-wider text-white/40 sm:block">
          {t("hint")}
        </span>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={t("prev")}
            onClick={() => go(-1)}
            disabled={current === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={t("next")}
            onClick={() => go(1)}
            disabled={current === total - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
        <div
          className="h-full bg-brand-primary transition-[width] duration-300"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations<"pitch">>;

// --- Slide shells ---------------------------------------------------------

function Slide({
  dark,
  children,
}: {
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className="flex h-full w-full items-center justify-center px-8 py-16 lg:px-16"
      style={dark ? { backgroundImage: DARK_GRADIENT } : undefined}
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary">
      {children}
    </div>
  );
}

// --- Slides ---------------------------------------------------------------

function TitleSlide({ brand, t }: { brand: string; t: T }) {
  return (
    <Slide dark>
      <div className="relative text-center">
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -z-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/25 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            {t("s1Badge")}
          </span>
          <h1 className="mx-auto mt-8 max-w-4xl font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            {t("s1Title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-accent/80 md:text-xl">
            {t("s1Sub", { brand })}
          </p>
        </div>
      </div>
    </Slide>
  );
}

function ProblemSlide({ t }: { t: T }) {
  const points = [
    { title: t("s2Point1Title"), body: t("s2Point1Body") },
    { title: t("s2Point2Title"), body: t("s2Point2Body") },
    { title: t("s2Point3Title"), body: t("s2Point3Body") },
  ];
  return (
    <Slide dark>
      <Eyebrow>{t("s2Eyebrow")}</Eyebrow>
      <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
        {t("s2Title")}
      </h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {points.map((p) => (
          <div
            key={p.title}
            className="rounded-card border border-white/10 bg-white/[0.04] p-6"
          >
            <div className="font-display text-xl font-semibold text-white">
              {p.title}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-brand-accent/70">
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

function SolutionSlide({ t }: { t: T }) {
  return (
    <Slide>
      <div className="text-center">
        <Eyebrow>{t("s3Eyebrow")}</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          {t("s3Title")}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-accent/80">
          {t("s3Body")}
        </p>
        <span className="mt-8 inline-flex items-center gap-2 rounded-pill bg-brand-primary/15 px-4 py-2 text-sm font-semibold text-brand-primary ring-1 ring-brand-primary/30">
          <ShieldCheck className="h-4 w-4" />
          {t("s3Pill")}
        </span>
      </div>
    </Slide>
  );
}

function MoneySlide({ brand, t }: { brand: string; t: T }) {
  const tags = [t("s4Tag1"), t("s4Tag2"), t("s4Tag3")];
  return (
    <Slide dark>
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <Eyebrow>{t("s4Eyebrow")}</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {t("s4Title")}
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-brand-accent/80">
            {t("s4Body", { brand })}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-white/15 bg-black/20 px-3 py-1.5 text-sm font-medium text-white/85 backdrop-blur"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="flex h-44 w-44 items-center justify-center rounded-full bg-brand-primary/15 ring-1 ring-brand-primary/30">
            <Wallet
              className="h-20 w-20 text-brand-primary"
              strokeWidth={1.5}
            />
          </div>
        </div>
      </div>
    </Slide>
  );
}

function GuestSlide({ t }: { t: T }) {
  const points = [
    { icon: UserRound, label: t("s5Point1") },
    { icon: Star, label: t("s5Point2") },
    { icon: MessagesSquare, label: t("s5Point3") },
  ];
  return (
    <Slide>
      <Eyebrow>{t("s5Eyebrow")}</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
        {t("s5Title")}
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-mute">
        {t("s5Body")}
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {points.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-card border border-brand-line bg-white p-5 text-brand-ink"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="font-display text-[15px] font-semibold">
              {label}
            </span>
          </div>
        ))}
      </div>
    </Slide>
  );
}

function FeaturesSlide({ t }: { t: T }) {
  return (
    <Slide>
      <div className="text-center">
        <Eyebrow>{t("s6Eyebrow")}</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          {t("s6Title")}
        </h2>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, key }) => (
          <div
            key={key}
            className="rounded-card border border-brand-line bg-white p-5 text-left text-brand-ink"
          >
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <Icon className="h-5 w-5" />
            </span>
            <div className="font-display text-[15px] font-semibold">
              {t(key)}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-mute">
              {t(`${key}Benefit`)}
            </p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

function PricingSlide({ plans, t }: { plans: CatalogProduct[]; t: T }) {
  return (
    <Slide dark>
      <div className="text-center">
        <Eyebrow>{t("s7Eyebrow")}</Eyebrow>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
          {t("s7Title")}
        </h2>
      </div>
      {plans.length === 0 ? (
        <p className="mt-10 text-center text-brand-accent/70">{t("s7Empty")}</p>
      ) : (
        <div
          className="mt-10 grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(plans.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-card border p-5 text-left ${
                plan.isRecommended
                  ? "border-brand-primary bg-white/[0.06] ring-1 ring-brand-primary/40"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {plan.isRecommended ? (
                <span className="absolute -top-3 left-5 rounded-pill bg-brand-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-dark">
                  {t("s7Recommended")}
                </span>
              ) : null}
              <div className="font-display text-lg font-semibold text-white">
                {plan.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-white">
                  {formatPrice(plan)}
                </span>
                {!plan.isFree ? (
                  <span className="text-[13px] text-brand-accent/60">
                    {t("s7PerMonth")}
                  </span>
                ) : null}
              </div>
              {plan.bullets.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {plan.bullets.slice(0, 4).map((b, i) => (
                    <li
                      key={i}
                      className="text-[13px] leading-snug text-brand-accent/75"
                    >
                      • {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Slide>
  );
}

function WhyNowSlide({ t }: { t: T }) {
  const points = [
    { title: t("s8Point1Title"), body: t("s8Point1Body") },
    { title: t("s8Point2Title"), body: t("s8Point2Body") },
    { title: t("s8Point3Title"), body: t("s8Point3Body") },
  ];
  return (
    <Slide dark>
      <Eyebrow>{t("s8Eyebrow")}</Eyebrow>
      <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
        {t("s8Title")}
      </h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {points.map((p, i) => (
          <div
            key={p.title}
            className="rounded-card border border-white/10 bg-white/[0.04] p-6"
          >
            <div className="font-display text-3xl font-bold text-brand-primary">
              0{i + 1}
            </div>
            <div className="mt-3 font-display text-lg font-semibold text-white">
              {p.title}
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-brand-accent/70">
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

function CtaSlide({ t }: { t: T }) {
  return (
    <Slide dark>
      <div className="relative text-center">
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -z-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/25 blur-3xl"
        />
        <div className="relative">
          <Eyebrow>{t("s9Eyebrow")}</Eyebrow>
          <h2 className="mx-auto mt-3 max-w-3xl font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            {t("s9Title")}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-brand-accent/80">
            {t("s9Body")}
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-[10px] bg-brand-primary px-6 py-3.5 text-base font-semibold text-white shadow-[0_12px_32px_-10px_rgba(16,185,129,0.45)] transition-colors hover:bg-white hover:text-brand-secondary"
          >
            {t("s9Cta")}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </Slide>
  );
}
