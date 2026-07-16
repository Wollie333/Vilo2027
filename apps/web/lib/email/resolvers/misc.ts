import {
  firstName,
  formatDateLong,
  formatMoney,
  guestDisplayName,
  planLabel,
} from "../formatters";

import { signReviewToken } from "../../review-token";

import type { AdminClient, EmailResolver } from "./types";
import { refId } from "./types";

async function loadHostUser(
  supabase: AdminClient,
  hostId: string,
): Promise<{ display_name: string; user_full_name: string | null } | null> {
  const { data: host } = await supabase
    .from("hosts")
    .select("display_name, user_id")
    .eq("id", hostId)
    .maybeSingle();
  if (!host) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", host.user_id)
    .maybeSingle();

  return {
    display_name: host.display_name,
    user_full_name: profile?.full_name ?? null,
  };
}

const subscriptionWelcomeResolver: EmailResolver = async (refs, ctx) => {
  const subId = refId(refs, "subscription_id");
  if (!subId) return {};
  const { data: sub } = await ctx.supabase
    .from("subscriptions")
    .select(
      "plan, billing_cycle, status, trial_ends_at, current_period_end, host_id",
    )
    .eq("id", subId)
    .maybeSingle();
  if (!sub) return {};

  const host = await loadHostUser(ctx.supabase, sub.host_id);
  const isTrial = sub.status === "trialing";

  return {
    hostFirstName: firstName(host?.user_full_name ?? host?.display_name),
    planName: planLabel(sub.plan),
    isTrial,
    trialEnds: isTrial ? formatDateLong(sub.trial_ends_at) : null,
    renewsAt: !isTrial ? formatDateLong(sub.current_period_end) : null,
  };
};

const subscriptionExpiringResolver: EmailResolver = async (refs, ctx) => {
  const subId = refId(refs, "subscription_id");
  if (!subId) return {};
  const { data: sub } = await ctx.supabase
    .from("subscriptions")
    .select("plan, current_period_end, host_id, billing_cycle")
    .eq("id", subId)
    .maybeSingle();
  if (!sub) return {};

  const host = await loadHostUser(ctx.supabase, sub.host_id);
  const price =
    typeof refs.price === "number"
      ? formatMoney(refs.price as number)
      : ((refs.price as string) ?? "—");

  return {
    hostFirstName: firstName(host?.user_full_name ?? host?.display_name),
    planName: planLabel(sub.plan),
    renewalDate: formatDateLong(sub.current_period_end),
    price,
  };
};

const subscriptionFailedResolver: EmailResolver = async (refs, ctx) => {
  const subId = refId(refs, "subscription_id");
  if (!subId) return {};
  const { data: sub } = await ctx.supabase
    .from("subscriptions")
    .select("plan, grace_period_ends_at, host_id")
    .eq("id", subId)
    .maybeSingle();
  if (!sub) return {};

  const host = await loadHostUser(ctx.supabase, sub.host_id);
  const amount =
    typeof refs.amount === "number"
      ? formatMoney(refs.amount as number)
      : ((refs.amount as string) ?? "—");

  return {
    hostFirstName: firstName(host?.user_full_name ?? host?.display_name),
    planName: planLabel(sub.plan),
    amount,
    gracePeriodEndsAt: formatDateLong(sub.grace_period_ends_at),
  };
};

const subscriptionRestrictedResolver: EmailResolver = async (refs, ctx) => {
  const subId = refId(refs, "subscription_id");
  if (!subId) return {};
  const { data: sub } = await ctx.supabase
    .from("subscriptions")
    .select("plan, host_id")
    .eq("id", subId)
    .maybeSingle();
  if (!sub) return {};

  const host = await loadHostUser(ctx.supabase, sub.host_id);
  return {
    hostFirstName: firstName(host?.user_full_name ?? host?.display_name),
    planName: planLabel(sub.plan),
  };
};

const reviewRequestResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const { data: booking } = await ctx.supabase
    .from("bookings")
    .select("guest_id, guest_name, property_id, host_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return {};

  const [{ data: listing }, host, guestUser] = await Promise.all([
    ctx.supabase
      .from("properties")
      .select("name")
      .eq("id", booking.property_id)
      .maybeSingle(),
    loadHostUser(ctx.supabase, booking.host_id),
    booking.guest_id
      ? ctx.supabase
          .from("user_profiles")
          .select("full_name")
          .eq("id", booking.guest_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // The template builds its own link from bookingId + reviewToken; sign the
  // token here (server-side) so the emailed link is always valid.
  return {
    guestFirstName: firstName(guestUser?.data?.full_name ?? booking.guest_name),
    listingName: listing?.name ?? "your stay",
    hostName: host?.user_full_name ?? host?.display_name ?? "your host",
    bookingId,
    reviewToken: signReviewToken(bookingId),
  };
};

const newReviewHostResolver: EmailResolver = async (refs, ctx) => {
  const reviewId = refId(refs, "review_id");
  if (!reviewId) return {};
  const { data: review } = await ctx.supabase
    .from("reviews")
    .select("rating, body, guest_id, host_id, property_id, booking_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return {};

  const [host, { data: guestUser }, { data: listing }, { data: booking }] =
    await Promise.all([
      loadHostUser(ctx.supabase, review.host_id),
      review.guest_id
        ? ctx.supabase
            .from("user_profiles")
            .select("full_name")
            .eq("id", review.guest_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ctx.supabase
        .from("properties")
        .select("name")
        .eq("id", review.property_id)
        .maybeSingle(),
      // Account-less guest → name comes from the booking.
      ctx.supabase
        .from("bookings")
        .select("guest_name")
        .eq("id", review.booking_id)
        .maybeSingle(),
    ]);

  const body = review.body ?? "";
  return {
    hostFirstName: firstName(host?.user_full_name ?? host?.display_name),
    guestName: guestDisplayName(
      guestUser?.full_name ?? booking?.guest_name ?? null,
    ),
    listingName: listing?.name ?? "your listing",
    rating: review.rating,
    excerpt: body.length > 200 ? `${body.slice(0, 200)}…` : body,
  };
};

const welcomeHostResolver: EmailResolver = async (refs, ctx) => {
  const hostId = refId(refs, "host_id");
  if (!hostId) return {};
  const host = await loadHostUser(ctx.supabase, hostId);
  if (!host) return {};
  return {
    firstName: firstName(host.user_full_name ?? host.display_name),
  };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

const listingPublishedHostResolver: EmailResolver = async (refs, ctx) => {
  const listingId = refId(refs, "property_id");
  if (!listingId) return {};

  const { data: listing } = await ctx.supabase
    .from("properties")
    .select("name, slug, base_price, currency, city, province, host_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return {};

  const host = await loadHostUser(ctx.supabase, listing.host_id);

  const { count: roomCount } = await ctx.supabase
    .from("property_rooms")
    .select("id", { count: "exact", head: true })
    .eq("property_id", listingId)
    .is("deleted_at", null)
    .eq("is_active", true);

  const path = listing.slug ? `/property/${listing.slug}` : "/dashboard";
  const listingUrl = `${APP_URL}${path}`;
  const location = [listing.city, listing.province].filter(Boolean).join(", ");

  return {
    firstName: firstName(host?.user_full_name ?? host?.display_name),
    listingName: listing.name ?? "your listing",
    listingUrl,
    displayUrl: listingUrl.replace(/^https?:\/\//, ""),
    fromPrice:
      listing.base_price == null
        ? undefined
        : formatMoney(Number(listing.base_price), listing.currency ?? "ZAR"),
    location: location || undefined,
    roomCount: roomCount ?? 0,
  };
};

// A published property has no cancellation policy. The cron queues only
// { listing_id, listing_name, missing_type } (snake_case, straight from SQL);
// everything the template renders is resolved here, so the queued payload stays
// thin and nothing stale can be emailed if the property changes before the drain.
const listingMissingPolicyResolver: EmailResolver = async (refs, ctx) => {
  const listingId = refId(refs, "listing_id");
  if (!listingId) return {};

  const { data: listing } = await ctx.supabase
    .from("properties")
    .select("name, host_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return {};

  // Re-check before emailing: the cron may have queued this hours ago and the
  // host may have fixed it since. Emailing "you have no policy" at someone who
  // just added one is worse than not emailing at all.
  const { count } = await ctx.supabase
    .from("property_policies")
    .select("id", { count: "exact", head: true })
    .eq("property_id", listingId)
    .eq("policy_type", "cancellation");
  if ((count ?? 0) > 0) return {};

  const host = await loadHostUser(ctx.supabase, listing.host_id);

  return {
    firstName: firstName(host?.user_full_name ?? host?.display_name),
    listingName: listing.name ?? "your listing",
    policiesUrl: `${APP_URL}/dashboard/properties/${listingId}/edit?tab=policies`,
    missingType: (refs.missing_type as string | undefined) ?? "cancellation",
  };
};

const accountSuspendedResolver: EmailResolver = async (refs, ctx) => {
  const hostId = refId(refs, "host_id");
  if (!hostId) return {};
  const host = await loadHostUser(ctx.supabase, hostId);
  return {
    hostFirstName: firstName(host?.user_full_name ?? host?.display_name),
    supportEmail: "support@wieloplatform.com",
  };
};

export const MISC_RESOLVERS: Record<string, EmailResolver> = {
  welcome_host: welcomeHostResolver,
  listing_published_host: listingPublishedHostResolver,
  listing_missing_policy: listingMissingPolicyResolver,
  account_suspended: accountSuspendedResolver,
  subscription_welcome: subscriptionWelcomeResolver,
  subscription_expiring: subscriptionExpiringResolver,
  subscription_failed: subscriptionFailedResolver,
  subscription_restricted: subscriptionRestrictedResolver,
  review_request_guest: reviewRequestResolver,
  new_review_host: newReviewHostResolver,
};
