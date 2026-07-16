"use client";

import { useState } from "react";
import {
  Calendar,
  MapPin,
  Users,
  Banknote,
  Clock,
  Eye,
  MessageSquare,
  Check,
  Bookmark,
  Lock,
  Zap,
  Star,
  CalendarCheck,
  CalendarX,
} from "lucide-react";

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

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

import type { LookingForPost } from "./RequestsBoard";
import { GuestVerificationIcons } from "./GuestTrustBadge";

interface RequestCardProps {
  post: LookingForPost;
}

export function RequestCard({ post }: RequestCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const guestSummary =
    post.children > 0 || post.infants > 0
      ? `${post.adults} adult${post.adults !== 1 ? "s" : ""}${post.children > 0 ? `, ${post.children} child${post.children !== 1 ? "ren" : ""}` : ""}${post.infants > 0 ? `, ${post.infants} infant${post.infants !== 1 ? "s" : ""}` : ""}`
      : `${post.adults} guest${post.adults !== 1 ? "s" : ""}`;

  const budgetDisplay =
    post.budget_min || post.budget_max
      ? post.budget_min && post.budget_max
        ? `R${post.budget_min.toLocaleString()} – R${post.budget_max.toLocaleString()}`
        : post.budget_max
          ? `Up to R${post.budget_max.toLocaleString()}`
          : `From R${post.budget_min?.toLocaleString()}`
      : null;

  const dateDisplay =
    post.check_in_date && post.check_out_date
      ? `${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${new Date(post.check_out_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
      : post.check_in_date
        ? `From ${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
        : "Flexible dates";

  const distanceDisplay = post.distance_km
    ? post.distance_km < 50
      ? `~${Math.round(post.distance_km)}km away`
      : post.distance_km < 200
        ? `~${Math.round(post.distance_km)}km`
        : null
    : null;

  const categoryColors: Record<string, string> = {
    accommodation: "bg-blue-100 text-blue-800",
    experience: "bg-purple-100 text-purple-800",
    venue: "bg-amber-100 text-amber-800",
    event: "bg-pink-100 text-pink-800",
    other: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="relative flex flex-col rounded-card border border-brand-line bg-white shadow-card transition-shadow hover:shadow-md">
      {/* Header with category and location */}
      <div className="flex items-start justify-between gap-2 border-b border-brand-line p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={categoryColors[post.category] ?? categoryColors.other}
          >
            {post.category}
          </Badge>
          {post.is_urgent && (
            <Badge variant="destructive" className="gap-1">
              <Zap className="h-3 w-3" />
              Urgent
            </Badge>
          )}
          {post.is_targeted && (
            <Badge className="gap-1 bg-amber-100 text-amber-800">
              <Star className="h-3 w-3 fill-amber-500" />
              For You
            </Badge>
          )}
        </div>
        {distanceDisplay && (
          <span
            className={`flex items-center gap-1 text-xs ${post.distance_km && post.distance_km < 50 ? "text-green-600" : "text-amber-600"}`}
          >
            <MapPin className="h-3 w-3" />
            {distanceDisplay}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Guest info */}
        <div className="mb-2 flex items-center gap-2">
          {post.guest_avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote guest avatar (Supabase storage); not a configured next/image host
            <img
              src={post.guest_avatar}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-xs font-medium text-brand-mute">
              {(post.guest_name ?? "G").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm text-brand-ink">
            {post.guest_name ?? "Guest"}
          </span>
          <GuestVerificationIcons verification={post.guest_verification} />
        </div>

        <h3 className="line-clamp-2 font-display text-base font-semibold text-brand-ink">
          {post.title}
        </h3>

        {post.location_text && (
          <p className="mt-1 flex items-center gap-1 text-sm text-brand-mute">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{post.location_text}</span>
            {post.search_radius_km && post.search_radius_km > 0 ? (
              <span className="shrink-0 text-brand-primary">
                · within {post.search_radius_km} km
              </span>
            ) : null}
          </p>
        )}

        <div className="mt-3 space-y-1.5 text-sm text-brand-ink">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-brand-mute" />
              <span>{dateDisplay}</span>
            </div>
            {post.availability.status !== "unknown" && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  post.availability.status === "available"
                    ? "text-green-600"
                    : post.availability.status === "partial"
                      ? "text-amber-600"
                      : "text-red-500"
                }`}
                title={post.availability.message}
              >
                {post.availability.status === "unavailable" ? (
                  <CalendarX className="h-3.5 w-3.5" />
                ) : (
                  <CalendarCheck className="h-3.5 w-3.5" />
                )}
                {post.availability.status === "available"
                  ? "Available"
                  : post.availability.status === "partial"
                    ? `${post.availability.available_count}/${post.availability.total_count}`
                    : "Booked"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-brand-mute" />
            <span>{guestSummary}</span>
          </div>
          {budgetDisplay && (
            <div className="flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5 text-brand-mute" />
              <span>
                {budgetDisplay}
                {post.budget_per && (
                  <span className="text-brand-mute"> /{post.budget_per}</span>
                )}
              </span>
            </div>
          )}
        </div>

        {post.description ? (
          <p className="mt-3 line-clamp-2 text-sm text-brand-mute">
            &ldquo;{post.description}&rdquo;
          </p>
        ) : !post.is_unlocked ? (
          // The brief + guest identity are withheld server-side until a lead
          // credit is spent — this says so rather than showing a blank card.
          <p className="mt-3 flex items-center gap-1.5 text-sm text-brand-mute">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Guest details are locked — unlock to read the full request.
          </p>
        ) : null}
      </div>

      {/* Footer with metrics and actions */}
      <div className="flex items-center justify-between border-t border-brand-line px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-brand-mute">
          <span className="flex items-center gap-1" title="Views">
            <Eye className="h-3.5 w-3.5" />
            {post.view_count}
          </span>
          <span className="flex items-center gap-1" title="Quotes sent">
            <MessageSquare className="h-3.5 w-3.5" />
            {post.quote_count > 5 ? "5+" : post.quote_count}
          </span>
          <span className="flex items-center gap-1" title="Posted">
            <Clock className="h-3.5 w-3.5" />
            {formatDistanceToNow(new Date(post.created_at))}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-brand-line px-4 py-3">
        {post.already_quoted ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            disabled
          >
            <Check className="h-4 w-4 text-green-600" />
            Quoted
          </Button>
        ) : (
          // Locked leads still route to the respond page — that's where the
          // unlock lives, so the host sees the request card + what a credit buys
          // before spending. One paywall, one place.
          <Button size="sm" className="flex-1 gap-1.5" asChild>
            <Link href={`/dashboard/looking-for/respond/${post.id}`}>
              {post.is_unlocked ? (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Send Quote
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Unlock &amp; Quote
                </>
              )}
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={() => setIsBookmarked(!isBookmarked)}
        >
          <Bookmark
            className={`h-4 w-4 ${isBookmarked ? "fill-brand-primary text-brand-primary" : ""}`}
          />
        </Button>
      </div>
    </div>
  );
}
