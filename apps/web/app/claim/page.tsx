import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgePercent,
  BedDouble,
  Bath,
  CalendarDays,
  ImageIcon,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = {
  title: "Claim your account",
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams?: { c?: string; next?: string };
}) {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Reached only via the magic link in the enquiry email / submit redirect,
  // which signs the lead in. No session → send them to log in.
  if (!user) redirect("/login?next=/claim");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, is_lead")
    .eq("id", user.id)
    .maybeSingle();

  const alreadyClaimed = profile ? profile.is_lead === false : false;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  // The enquiry thread to drop them into after claiming (passed as ?c=). Where
  // they land = the thread that holds the quote request they just sent.
  const conversationId = searchParams?.c ?? null;
  const target =
    searchParams?.next ||
    (conversationId ? `/portal/inbox/${conversationId}` : "/portal/trips");

  // Pull a small summary of that enquiry so they can SEE what they just sent.
  let enquiry: {
    hostName: string;
    listingName: string | null;
    photoUrl: string | null;
    location: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    maxGuests: number | null;
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
    headcount: number | null;
    total: number | null;
    currency: string;
  } | null = null;
  if (conversationId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select(
        "id, host:hosts ( display_name ), listing:listings ( id, name, city, province, bedrooms, bathrooms, max_guests )",
      )
      .eq("id", conversationId)
      .eq("guest_id", user.id)
      .maybeSingle();
    if (conv) {
      const host = one(
        (
          conv as {
            host: { display_name: string } | { display_name: string }[] | null;
          }
        ).host,
      );
      type ListingRow = {
        id: string;
        name: string | null;
        city: string | null;
        province: string | null;
        bedrooms: number | null;
        bathrooms: number | null;
        max_guests: number | null;
      };
      const listing = one(
        (conv as { listing: ListingRow | ListingRow[] | null }).listing,
      );
      // Dates/totals live on the quote, and the cover photo lookup is keyed by
      // listing — neither is reliably guest-readable via RLS, so fetch both
      // with the admin client (scoped to this verified-owned conversation).
      const admin = createAdminClient();
      const [{ data: q }, { data: photo }] = await Promise.all([
        admin
          .from("quotes")
          .select("check_in, check_out, headcount, total_amount, currency")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        listing?.id
          ? admin
              .from("listing_photos")
              .select("url")
              .eq("listing_id", listing.id)
              .order("sort_order", { ascending: true })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const nights =
        q?.check_in && q?.check_out
          ? Math.max(
              1,
              Math.round(
                (new Date(q.check_out).getTime() -
                  new Date(q.check_in).getTime()) /
                  86_400_000,
              ),
            )
          : null;
      const city = listing?.city ?? null;
      const province = listing?.province ?? null;
      enquiry = {
        hostName: host?.display_name ?? "the host",
        listingName: listing?.name ?? null,
        photoUrl: (photo as { url: string } | null)?.url ?? null,
        location: [city, province].filter(Boolean).join(", ") || null,
        bedrooms: listing?.bedrooms ?? null,
        bathrooms: listing?.bathrooms ?? null,
        maxGuests: listing?.max_guests ?? null,
        checkIn: q?.check_in ?? null,
        checkOut: q?.check_out ?? null,
        nights,
        headcount: q?.headcount ?? null,
        total: q?.total_amount ?? null,
        currency: q?.currency ?? "ZAR",
      };
    }
  }

  return (
    <div className="min-h-screen w-full bg-brand-light text-brand-ink">
      {/* Mobile brand header */}
      <div className="flex items-center justify-between px-5 py-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-brand-gradient text-sm font-bold text-white">
            V
          </div>
          <span className="font-display text-[15px] font-bold">
            {brandName}
          </span>
        </div>
        <Link
          href="/login"
          className="text-[13px] font-medium text-brand-mute hover:text-brand-ink"
        >
          Sign in
        </Link>
      </div>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[1fr_minmax(0,480px)]">
        {/* LEFT — set a password (mirrors the signup fields column) */}
        <div className="flex flex-col justify-center px-6 py-10 lg:px-14 lg:py-16">
          <div className="mx-auto w-full max-w-md">
            <div className="hidden items-center gap-2 lg:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-gradient text-base font-bold text-white">
                V
              </div>
              <span className="font-display text-[15px] font-bold">
                {brandName}
              </span>
            </div>

            <h1 className="mt-6 font-display text-[26px] font-bold leading-tight tracking-tight text-brand-ink lg:text-[30px]">
              {alreadyClaimed
                ? "Your account is ready"
                : `Thanks${firstName ? `, ${firstName}` : ""} — your request is in!`}
            </h1>
            <p className="mt-1.5 max-w-md text-sm text-brand-mute">
              {alreadyClaimed
                ? "You've already set a password — you can sign in any time."
                : `Set a password to finish your free ${brandName} account — track this quote, chat with the host, and book faster next time.`}
            </p>

            <div className="mt-6">
              {alreadyClaimed ? (
                <Link
                  href={target}
                  className="inline-flex w-full items-center justify-center rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
                >
                  {conversationId ? "Go to your request" : "Go to my trips"}
                </Link>
              ) : (
                <ClaimForm next={target} />
              )}
            </div>

            {!alreadyClaimed ? (
              <>
                <ul className="mt-6 space-y-2.5 border-t border-brand-line pt-5">
                  <li className="flex items-start gap-2.5 text-[12.5px] text-brand-mute">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <span>
                      Chat with the host straight away — sort out the details
                      without waiting on email.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-[12.5px] text-brand-mute">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <span>
                      Keep this quote and every future booking safely in one
                      place.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-[12.5px] text-brand-mute">
                    <BadgePercent className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <span>
                      Book faster next time and unlock guest perks across{" "}
                      {brandName}.
                    </span>
                  </li>
                </ul>

                <div className="mt-5 flex items-center gap-4 text-[12.5px] font-medium text-brand-mute">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-brand-primary" />
                    Email
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4 text-brand-primary" />
                    WhatsApp
                  </span>
                  <span className="text-brand-mute/70">
                    — that&rsquo;s how the host&rsquo;s reply reaches you.
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* RIGHT — what they just requested (dark hero, mirrors signup rail) */}
        <aside className="relative overflow-hidden bg-brand-gradient-dark px-6 py-10 text-white lg:px-12 lg:py-16">
          <div aria-hidden className="dotgrid absolute inset-0 opacity-20" />
          <div
            aria-hidden
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/20 blur-3xl"
          />
          <div className="relative mx-auto flex h-full w-full max-w-sm flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-accent backdrop-blur">
              <MessageSquare className="h-3 w-3" />
              Request sent
            </div>

            {enquiry ? (
              <div className="mt-4 overflow-hidden rounded-card border border-white/10 bg-white/5 backdrop-blur">
                <div className="relative aspect-[16/9] w-full bg-white/10">
                  {enquiry.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={enquiry.photoUrl}
                      alt={enquiry.listingName ?? "Listing"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/40">
                      <ImageIcon className="h-7 w-7" />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {enquiry.listingName ? (
                    <div className="font-display text-[15px] font-bold leading-tight">
                      {enquiry.listingName}
                    </div>
                  ) : null}
                  <div className="mt-0.5 text-[12px] text-brand-accent/70">
                    Hosted by {enquiry.hostName}
                  </div>

                  {enquiry.location ? (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-brand-accent/70">
                      <MapPin className="h-3.5 w-3.5" />
                      {enquiry.location}
                    </div>
                  ) : null}

                  {enquiry.bedrooms != null ||
                  enquiry.bathrooms != null ||
                  enquiry.maxGuests != null ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-brand-accent/70">
                      {enquiry.bedrooms != null ? (
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" />
                          {enquiry.bedrooms} bd
                        </span>
                      ) : null}
                      {enquiry.bathrooms != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" />
                          {enquiry.bathrooms} ba
                        </span>
                      ) : null}
                      {enquiry.maxGuests != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Sleeps {enquiry.maxGuests}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-[12.5px]">
                    {enquiry.checkIn ? (
                      <div className="flex items-center justify-between">
                        <dt className="inline-flex items-center gap-1.5 text-brand-accent/70">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Dates
                        </dt>
                        <dd className="font-semibold text-white">
                          {fmtDate(enquiry.checkIn)} →{" "}
                          {fmtDate(enquiry.checkOut)}
                          {enquiry.nights != null ? (
                            <span className="ml-1 font-normal text-brand-accent/60">
                              ({enquiry.nights}{" "}
                              {enquiry.nights === 1 ? "night" : "nights"})
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    ) : null}
                    {enquiry.headcount != null ? (
                      <div className="flex items-center justify-between">
                        <dt className="inline-flex items-center gap-1.5 text-brand-accent/70">
                          <Users className="h-3.5 w-3.5" />
                          Guests
                        </dt>
                        <dd className="font-semibold text-white">
                          {enquiry.headcount}
                        </dd>
                      </div>
                    ) : null}
                    {enquiry.total != null ? (
                      <div className="flex items-center justify-between">
                        <dt className="text-brand-accent/70">
                          Estimated total
                        </dt>
                        <dd className="font-semibold text-white">
                          {formatMoney(enquiry.total, enquiry.currency)}
                          <span className="ml-1 font-normal text-brand-accent/60">
                            est.
                          </span>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {enquiry.total != null ? (
                    <p className="mt-2 text-[11px] leading-snug text-brand-accent/60">
                      An estimate only — {enquiry.hostName.split(" ")[0]} will
                      confirm your final quote.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-4 max-w-xs text-sm text-brand-accent/80">
                Your request is on its way to the host. They&rsquo;ll reply with
                a tailored quote shortly — by email and WhatsApp.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
