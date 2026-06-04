import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Star } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReviewToken } from "@/lib/review-token";

import { ReviewSubmissionForm } from "./ReviewSubmissionForm";

export const metadata: Metadata = {
  title: "Leave a review",
};

export const dynamic = "force-dynamic";

type Props = {
  params: { bookingId: string };
  searchParams?: { token?: string };
};

function nightsLabel(n: number | null | undefined): string {
  if (!n) return "";
  return `${n} ${n === 1 ? "night" : "nights"}`;
}

function checkoutMonth(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

export default async function ReviewSubmissionPage({
  params,
  searchParams,
}: Props) {
  const token = (searchParams?.token ?? "").trim();
  if (!token || !verifyReviewToken(params.bookingId, token)) {
    return (
      <ReviewShell>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          This review link isn&apos;t valid
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          The link may have expired, or it was copied incorrectly. If you stayed
          at a Vilo listing recently and didn&apos;t receive a fresh email, get
          in touch at{" "}
          <a
            className="text-brand-primary underline-offset-2 hover:underline"
            href="mailto:hello@viloplatform.com"
          >
            hello@viloplatform.com
          </a>
          .
        </p>
      </ReviewShell>
    );
  }

  const admin = createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select(
      `
      id, status, check_in, check_out, nights, guest_name, checked_out_at,
      listing:listings ( name, slug ),
      host:hosts ( display_name )
    `,
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (!booking) {
    return (
      <ReviewShell>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          We couldn&apos;t find that booking
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          The booking may have been removed. Reach out to your host directly or
          contact{" "}
          <a
            className="text-brand-primary underline-offset-2 hover:underline"
            href="mailto:hello@viloplatform.com"
          >
            hello@viloplatform.com
          </a>
          .
        </p>
      </ReviewShell>
    );
  }

  if (booking.status !== "completed") {
    return (
      <ReviewShell>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Reviews open after checkout
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          You&apos;ll be able to leave a review once your stay is marked as
          complete. We&apos;ll email you a fresh link.
        </p>
      </ReviewShell>
    );
  }

  const { data: existing } = await admin
    .from("reviews")
    .select("id, rating, body, created_at")
    .eq("booking_id", params.bookingId)
    .maybeSingle();

  if (existing) {
    return (
      <ReviewShell>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-status-confirmed">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-center font-display text-2xl font-bold text-brand-ink">
          Thanks — your review is in
        </h1>
        <p className="mt-2 text-center text-sm text-brand-mute">
          Your review will be published publicly within 48 hours.
        </p>
        <div className="mx-auto mt-6 max-w-md rounded-card border border-brand-line bg-brand-light/50 p-5">
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-5 w-5 ${
                  n <= existing.rating
                    ? "fill-amber-400 text-amber-400"
                    : "text-brand-mute/40"
                }`}
              />
            ))}
          </div>
          {existing.body ? (
            <p className="mt-3 text-sm leading-relaxed text-brand-ink">
              &ldquo;{existing.body}&rdquo;
            </p>
          ) : null}
        </div>
      </ReviewShell>
    );
  }

  // Supabase Postgrest sometimes returns FK joins as arrays even with !inner;
  // unwrap defensively.
  const listing = Array.isArray(booking.listing)
    ? booking.listing[0]
    : booking.listing;
  const host = Array.isArray(booking.host) ? booking.host[0] : booking.host;

  return (
    <ReviewShell>
      <header className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">
          Vilo review
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-ink">
          How was your stay?
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          {listing?.name ? (
            <>
              <span className="font-medium text-brand-ink">{listing.name}</span>
              {host?.display_name ? ` · hosted by ${host.display_name}` : ""}
            </>
          ) : (
            "Tell future guests what to expect."
          )}
          {booking.nights ? (
            <>
              {" · "}
              {nightsLabel(booking.nights)}
            </>
          ) : null}
          {checkoutMonth(booking.check_out) ? (
            <>
              {" · "}
              {checkoutMonth(booking.check_out)}
            </>
          ) : null}
        </p>
      </header>

      <ReviewSubmissionForm bookingId={params.bookingId} token={token} />

      <p className="mt-6 text-center text-[12px] text-brand-mute">
        Reviews are public after a 48-hour moderation window. You can&apos;t
        edit your review once submitted — write what you&apos;d want a fellow
        traveller to read.
      </p>

      {listing?.slug ? (
        <p className="mt-4 text-center text-[12px]">
          <Link
            href={`/listing/${listing.slug}`}
            className="text-brand-primary underline-offset-2 hover:underline"
          >
            View the listing
          </Link>
        </p>
      ) : null}
    </ReviewShell>
  );
}

function ReviewShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-brand-cream min-h-dvh px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-xl rounded-card border border-brand-line bg-white p-7 shadow-card sm:p-10">
        {children}
      </div>
    </main>
  );
}
