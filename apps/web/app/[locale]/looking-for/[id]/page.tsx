import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Banknote,
  Eye,
  MessageSquare,
  Zap,
  Share2,
} from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";
import { stripHtml } from "@/lib/sanitiseHtml";
import { RequestDetailsHtml } from "@/components/looking-for/RequestDetailsHtml";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { QuoteButton } from "../_components/QuoteButton";

// Native date formatting utility
function formatDistanceToNow(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "just now";
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: post } = await supabase
    .from("looking_for_posts")
    .select(
      "title, description, category, location_region, check_in_date, check_out_date, adults",
    )
    .eq("id", id)
    .eq("is_public", true)
    .eq("status", "active")
    .single();

  if (!post) {
    return {
      title: "Request Not Found | Wielo",
    };
  }

  const descText = post.description ? stripHtml(post.description) : "";
  const description = descText
    ? descText.slice(0, 155) + (descText.length > 155 ? "..." : "")
    : `Looking for ${post.category}${post.location_region ? ` in ${post.location_region}` : ""}${post.adults ? ` for ${post.adults} guests` : ""}`;

  return {
    title: `${post.title} | Looking For | Wielo`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      siteName: "Wielo",
    },
    twitter: {
      card: "summary",
      title: post.title,
      description,
    },
  };
}

export default async function PublicPostDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  // Viewer auth state — signed-in hosts go straight to the respond page;
  // signed-out visitors get the sign-in-to-quote modal.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = Boolean(user);

  // Fetch the post
  const { data: post, error } = await supabase
    .from("looking_for_posts")
    .select(
      `
      id,
      title,
      description,
      category,
      check_in_date,
      check_out_date,
      adults,
      children,
      infants,
      location_text,
      location_region,
      budget_min,
      budget_max,
      budget_currency,
      budget_per,
      status,
      is_urgent,
      is_public,
      view_count,
      quote_count,
      created_at,
      expires_at,
      image_url,
      guest:user_profiles!guest_id(full_name, avatar_url)
    `,
    )
    .eq("id", id)
    .single();

  if (error || !post) {
    notFound();
  }

  // Only show public active posts
  if (!post.is_public || post.status !== "active") {
    notFound();
  }

  // Check if expired
  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  if (isExpired) {
    notFound();
  }

  const guest = post.guest as unknown as {
    full_name: string | null;
    avatar_url: string | null;
  } | null;

  const guestSummary =
    (post.children ?? 0) > 0 || (post.infants ?? 0) > 0
      ? `${post.adults} adult${post.adults !== 1 ? "s" : ""}${(post.children ?? 0) > 0 ? `, ${post.children} child${(post.children ?? 0) !== 1 ? "ren" : ""}` : ""}${(post.infants ?? 0) > 0 ? `, ${post.infants} infant${(post.infants ?? 0) !== 1 ? "s" : ""}` : ""}`
      : `${post.adults} guest${post.adults !== 1 ? "s" : ""}`;

  const budgetDisplay =
    post.budget_min || post.budget_max
      ? post.budget_min && post.budget_max
        ? `R${post.budget_min.toLocaleString()} – R${post.budget_max.toLocaleString()}`
        : post.budget_max
          ? `Up to R${post.budget_max.toLocaleString()}`
          : `From R${post.budget_min?.toLocaleString()}`
      : "Flexible";

  const dateDisplay =
    post.check_in_date && post.check_out_date
      ? `${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(post.check_out_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
      : post.check_in_date
        ? `From ${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
        : "Flexible dates";

  const daysLeft = post.expires_at
    ? Math.ceil(
        (new Date(post.expires_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  // Increment view count (fire and forget)
  supabase
    .from("looking_for_posts")
    .update({ view_count: (post.view_count ?? 0) + 1 })
    .eq("id", id)
    .then(() => {});

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      {/* Back / share bar */}
      <div className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="gap-1.5">
              <Link href="/looking-for">
                <ArrowLeft className="h-4 w-4" />
                Back to directory
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Guest photo */}
            {post.image_url && (
              <div className="aspect-[16/9] w-full overflow-hidden rounded-card border border-brand-line bg-brand-light">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image_url}
                  alt={post.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Post card */}
            <div className="rounded-card border border-brand-line bg-white">
              <div className="border-b border-brand-line p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {post.category}
                  </Badge>
                  {post.is_urgent && (
                    <Badge variant="destructive" className="gap-1">
                      <Zap className="h-3 w-3" />
                      Urgent
                    </Badge>
                  )}
                  {post.location_region && (
                    <span className="text-sm text-brand-mute">
                      {post.location_region}
                    </span>
                  )}
                </div>
                <h1 className="font-display text-2xl font-bold text-brand-ink">
                  {post.title}
                </h1>
                {guest?.full_name && (
                  <p className="mt-2 text-sm text-brand-mute">
                    Posted by {guest.full_name}
                  </p>
                )}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 border-b border-brand-line p-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-brand-mute">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </div>
                  <p className="text-sm font-medium text-brand-ink">
                    {post.location_text ?? post.location_region ?? "Flexible"}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-brand-mute">
                    <Calendar className="h-3.5 w-3.5" />
                    Dates
                  </div>
                  <p className="text-sm font-medium text-brand-ink">
                    {dateDisplay}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-brand-mute">
                    <Users className="h-3.5 w-3.5" />
                    Guests
                  </div>
                  <p className="text-sm font-medium text-brand-ink">
                    {guestSummary}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-brand-mute">
                    <Banknote className="h-3.5 w-3.5" />
                    Budget
                  </div>
                  <p className="text-sm font-medium text-brand-ink">
                    {budgetDisplay}
                    {post.budget_per &&
                      (post.budget_min || post.budget_max) && (
                        <span className="text-brand-mute">
                          {" "}
                          /{post.budget_per}
                        </span>
                      )}
                  </p>
                </div>
              </div>

              {/* Description */}
              {post.description && (
                <div className="border-b border-brand-line p-6">
                  <h2 className="mb-2 text-sm font-medium text-brand-mute">
                    Additional Details
                  </h2>
                  <RequestDetailsHtml
                    html={post.description}
                    className="text-brand-ink"
                  />
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4 text-sm text-brand-mute">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    {post.view_count} views
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    {post.quote_count > 5 ? "5+" : post.quote_count} quotes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Posted {formatDistanceToNow(new Date(post.created_at))}
                  </span>
                </div>
                {daysLeft !== null && (
                  <span
                    className={`text-sm ${daysLeft <= 3 ? "font-medium text-amber-600" : "text-brand-mute"}`}
                  >
                    {daysLeft <= 0
                      ? "Expires today"
                      : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* CTA for hosts */}
            <div className="rounded-card border border-brand-line bg-white p-6">
              <h2 className="font-display font-semibold text-brand-ink">
                Respond to this request
              </h2>
              <p className="mt-2 text-sm text-brand-mute">
                Send this guest a direct quote — no commission on the booking.
              </p>
              <QuoteButton
                postId={id}
                authed={authed}
                size="lg"
                className="mt-4"
              />
              {!authed && (
                <p className="mt-3 text-center text-xs text-brand-mute">
                  Not a host yet?{" "}
                  <Link
                    href="/signup/host"
                    className="text-brand-primary underline"
                  >
                    Get started free
                  </Link>
                </p>
              )}
            </div>

            {/* Info box */}
            <div className="rounded-card bg-brand-accent p-4">
              <h3 className="text-sm font-medium text-brand-ink">
                About Looking For
              </h3>
              <p className="mt-1 text-xs text-brand-mute">
                Guests post what they&apos;re looking for and hosts can respond
                with personalized quotes. It&apos;s a great way to connect
                directly with travelers.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
