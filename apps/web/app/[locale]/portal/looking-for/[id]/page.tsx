import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  Eye,
  MapPin,
  MessageSquare,
  Users,
  Banknote,
  Zap,
} from "lucide-react";
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

import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { PostActions } from "./_components/PostActions";
import { markQuotesViewedAction } from "../actions";
import { RequestDetailsHtml } from "@/components/looking-for/RequestDetailsHtml";
import { RequestRequirements } from "@/components/looking-for/RequestRequirements";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/portal/looking-for/${id}`);
  }

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
      date_flexibility_days,
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
      fulfilled_via,
      guest_id
    `,
    )
    .eq("id", id)
    .single();

  if (error || !post) {
    notFound();
  }

  // Verify ownership
  if (post.guest_id !== user.id) {
    redirect("/portal/looking-for");
  }

  // Mark any unseen quotes as viewed + notify their hosts (fire-and-forget).
  // The compare page does this too, but a guest with a single quote never gets
  // there (the Compare link only shows for >1 quote), so the host's "quote
  // viewed" notification would otherwise never fire.
  markQuotesViewedAction(id).catch(() => {});

  // Fetch received quotes/responses
  const { data: responses } = await supabase
    .from("looking_for_responses")
    .select(
      `
      id,
      status,
      sent_at,
      viewed_at,
      host:hosts(
        id,
        display_name,
        logo_url
      ),
      quote:quotes(
        id,
        total_amount,
        currency,
        status,
        expires_at
      )
    `,
    )
    .eq("post_id", id)
    .order("sent_at", { ascending: false });

  const guestSummary =
    (post.children ?? 0) > 0 || (post.infants ?? 0) > 0
      ? `${post.adults} adult${post.adults !== 1 ? "s" : ""}${(post.children ?? 0) > 0 ? `, ${post.children} child${post.children !== 1 ? "ren" : ""}` : ""}${(post.infants ?? 0) > 0 ? `, ${post.infants} infant${post.infants !== 1 ? "s" : ""}` : ""}`
      : `${post.adults} guest${post.adults !== 1 ? "s" : ""}`;

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const daysLeft = post.expires_at
    ? Math.ceil(
        (new Date(post.expires_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href="/portal/looking-for">
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/looking-for/${id}/edit`}>
              <Edit className="mr-1.5 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <PostActions postId={id} status={post.status} />
        </div>
      </div>

      {/* Post Details Card */}
      <div className="rounded-card border border-brand-line bg-white">
        <div className="border-b border-brand-line p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge status={post.status} />
                <Badge variant="secondary" className="capitalize">
                  {post.category}
                </Badge>
                {post.is_urgent && (
                  <Badge variant="destructive" className="gap-1">
                    <Zap className="h-3 w-3" />
                    Urgent
                  </Badge>
                )}
                {!post.is_public && <Badge variant="outline">Private</Badge>}
              </div>
              <h1 className="font-display text-xl font-bold text-brand-ink">
                {post.title}
              </h1>
            </div>
          </div>

          {post.description && (
            <RequestDetailsHtml html={post.description} className="mt-3" />
          )}
          <RequestRequirements postId={id} className="mt-4" />
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-brand-line p-6 md:grid-cols-4">
          {/* Location */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-brand-mute">
              <MapPin className="h-3.5 w-3.5" />
              Location
            </div>
            <p className="text-sm font-medium text-brand-ink">
              {post.location_text ?? post.location_region ?? "Flexible"}
            </p>
          </div>

          {/* Dates */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-brand-mute">
              <Calendar className="h-3.5 w-3.5" />
              Dates
            </div>
            <p className="text-sm font-medium text-brand-ink">
              {post.check_in_date && post.check_out_date
                ? `${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${new Date(post.check_out_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                : post.check_in_date
                  ? `From ${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
                  : "Flexible"}
            </p>
            {post.check_in_date && (post.date_flexibility_days ?? 0) > 0 && (
              <p className="text-xs text-brand-mute">
                {post.date_flexibility_days === 7
                  ? "± 1 week flexible"
                  : post.date_flexibility_days === 14
                    ? "± 2 weeks flexible"
                    : `± ${post.date_flexibility_days} day${post.date_flexibility_days === 1 ? "" : "s"} flexible`}
              </p>
            )}
          </div>

          {/* Guests */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-brand-mute">
              <Users className="h-3.5 w-3.5" />
              Guests
            </div>
            <p className="text-sm font-medium text-brand-ink">{guestSummary}</p>
          </div>

          {/* Budget */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-brand-mute">
              <Banknote className="h-3.5 w-3.5" />
              Budget
            </div>
            <p className="text-sm font-medium text-brand-ink">
              {post.budget_min || post.budget_max
                ? post.budget_min && post.budget_max
                  ? `R${post.budget_min.toLocaleString()} – R${post.budget_max.toLocaleString()}`
                  : post.budget_max
                    ? `Up to R${post.budget_max.toLocaleString()}`
                    : `From R${post.budget_min?.toLocaleString()}`
                : "Flexible"}
              {post.budget_per && (post.budget_min || post.budget_max) && (
                <span className="text-brand-mute"> /{post.budget_per}</span>
              )}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-6 text-sm text-brand-mute">
            <span className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              {post.view_count} views
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              {post.quote_count} quotes
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Posted {formatDistanceToNow(new Date(post.created_at))}
            </span>
          </div>

          {post.status === "active" && daysLeft !== null && (
            <span
              className={`text-sm ${daysLeft <= 3 ? "font-medium text-amber-600" : "text-brand-mute"}`}
            >
              {isExpired
                ? "Expired"
                : daysLeft <= 0
                  ? "Expires today"
                  : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
            </span>
          )}
        </div>
      </div>

      {/* Received Quotes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            Received Quotes ({responses?.length ?? 0})
          </h2>
          {(responses?.length ?? 0) > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/looking-for/${id}/quotes`}>
                Compare Quotes
              </Link>
            </Button>
          )}
        </div>

        {!responses || responses.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand-mute">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-brand-ink">No quotes yet</h3>
            <p className="mt-1 text-sm text-brand-mute">
              Hosts will send you quotes when they see your request
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((response) => {
              const host = response.host as unknown as {
                id: string;
                display_name: string;
                logo_url: string | null;
              } | null;
              const quote = response.quote as unknown as {
                id: string;
                total_amount: number;
                currency: string;
                status: string;
                expires_at: string | null;
              } | null;

              return (
                <div
                  key={response.id}
                  className="flex items-center justify-between rounded-card border border-brand-line bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light font-medium text-brand-mute">
                      {host?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={host.logo_url}
                          alt={host.display_name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        (host?.display_name?.charAt(0).toUpperCase() ?? "H")
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-brand-ink">
                        {host?.display_name ?? "Host"}
                      </h3>
                      <p className="text-sm text-brand-mute">
                        Sent {formatDistanceToNow(new Date(response.sent_at))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {quote && (
                      <div className="text-right">
                        <p className="font-semibold text-brand-ink">
                          {quote.currency === "ZAR" ? "R" : quote.currency}
                          {quote.total_amount.toLocaleString()}
                        </p>
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/portal/quotes/${quote?.id}`}>
                        View Quote
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-600",
    expired: "bg-amber-100 text-amber-700",
    fulfilled: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function QuoteStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "text-gray-500",
    sent: "text-blue-600",
    viewed: "text-blue-600",
    accepted: "text-green-600",
    declined: "text-red-600",
    expired: "text-amber-600",
  };

  return (
    <span className={`text-xs ${styles[status] ?? styles.sent}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
