import { ArrowRight, ShieldCheck, Star, Zap } from "lucide-react";

import { formatMoney } from "@/lib/format";

// Display-only booking panel. The listing page no longer lets guests pick
// rooms/dates/guests inline — they either Reserve (→ self-contained booking
// flow where all selection happens) or Request a quote (→ existing modal).
// Renders both the sticky desktop card and the mobile sticky bottom bar.
export function ReservePanel({
  slug,
  basePrice,
  currency,
  rating,
  reviewCount,
  instantBooking,
  refundNote,
  quoteButton,
  quoteButtonMobile,
}: {
  slug: string;
  basePrice: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  instantBooking: boolean;
  refundNote: string;
  quoteButton: React.ReactNode;
  quoteButtonMobile: React.ReactNode;
}) {
  const reserveHref = `/listing/${encodeURIComponent(slug)}/book`;
  const hasRating = rating != null && reviewCount != null && reviewCount > 0;

  return (
    <>
      {/* ── Desktop sticky card ──────────────────────────────────── */}
      <div
        className="book-dark sticky top-32 isolate hidden max-h-[calc(100vh-9rem)] overflow-y-auto overflow-x-hidden rounded-card p-5 text-white lg:block"
        style={{
          background:
            "linear-gradient(155deg,#11201A 0%,#0A1410 55%,#060F0B 100%)",
          boxShadow:
            "0 34px 74px -30px rgba(6,40,30,0.72),0 10px 28px -16px rgba(0,0,0,0.34)",
        }}
      >
        <div
          aria-hidden
          className="dotgrid pointer-events-none absolute inset-0 -z-10 opacity-[0.13]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 -z-10 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl"
        />

        <div className="flex items-baseline justify-between gap-2">
          <div>
            {basePrice != null ? (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  From{" "}
                </span>
                <span className="num font-display text-3xl font-bold tracking-tight text-brand-ink">
                  {formatMoney(basePrice, currency)}
                </span>
                <span className="ml-1 text-sm text-brand-mute">/ night</span>
              </>
            ) : (
              <span className="text-sm text-brand-mute">Price on request</span>
            )}
          </div>
          {hasRating ? (
            <div className="flex items-center gap-1 text-sm text-brand-ink">
              <Star className="h-4 w-4 fill-brand-ink stroke-brand-ink" />
              <span className="num font-semibold">{rating!.toFixed(2)}</span>
              <span className="text-brand-mute">·</span>
              <span className="num text-brand-mute">{reviewCount}</span>
            </div>
          ) : null}
        </div>

        {instantBooking ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-bold">
            <Zap className="h-3 w-3" /> Instant book
          </div>
        ) : null}

        <a
          href={reserveHref}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-5 py-3.5 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary"
        >
          Reserve <ArrowRight className="h-4 w-4" />
        </a>

        <div className="mt-3">{quoteButton}</div>

        <div className="mt-3 text-center text-[11px] text-brand-mute">
          You won&rsquo;t be charged yet · choose your dates &amp; rooms next.
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded border border-brand-line bg-brand-light p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          <div className="text-[11px] leading-relaxed text-brand-mute">
            {refundNote} Held securely until your trip is confirmed.
          </div>
        </div>
      </div>

      {/* ── Mobile sticky bottom bar ─────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(6,78,59,0.18)] lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            {basePrice != null ? (
              <div className="font-display font-bold text-brand-ink">
                <span className="num">{formatMoney(basePrice, currency)}</span>
                <span className="text-xs font-normal text-brand-mute">
                  {" "}
                  / night
                </span>
              </div>
            ) : (
              <div className="font-display text-sm font-semibold text-brand-ink">
                Price on request
              </div>
            )}
            <div className="truncate text-[11px] text-brand-mute">
              You won&rsquo;t be charged yet
            </div>
          </div>
          {quoteButtonMobile}
          <a
            href={reserveHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary"
          >
            Reserve <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </>
  );
}
