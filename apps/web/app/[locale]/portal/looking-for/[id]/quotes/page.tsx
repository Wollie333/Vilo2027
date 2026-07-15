import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { markQuotesViewedAction } from "../../actions";

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

export default async function CompareQuotesPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/portal/looking-for/${id}/quotes`);
  }

  // Fetch the post
  const { data: post, error: postError } = await supabase
    .from("looking_for_posts")
    .select("id, title, guest_id")
    .eq("id", id)
    .single();

  if (postError || !post) {
    notFound();
  }

  // Verify ownership
  if (post.guest_id !== user.id) {
    redirect("/portal/looking-for");
  }

  // Mark quotes as viewed and notify hosts (fire and forget)
  markQuotesViewedAction(id).catch(() => {});

  // Fetch all responses with full quote details
  const { data: responses } = await supabase
    .from("looking_for_responses")
    .select(
      `
      id,
      status,
      sent_at,
      host:hosts(
        id,
        display_name,
        avatar_url,
        bio
      ),
      quote:quotes(
        id,
        total_amount,
        currency,
        status,
        valid_until,
        check_in,
        check_out,
        headcount,
        deposit_amount,
        notes
      )
    `,
    )
    .eq("post_id", id)
    .order("sent_at", { ascending: false });

  if (!responses || responses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href={`/portal/looking-for/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to request
            </Link>
          </Button>
        </div>

        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No quotes to compare
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            Wait for hosts to send you quotes, then come back to compare them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href={`/portal/looking-for/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold text-brand-ink">
              Compare Quotes
            </h1>
            <p className="text-sm text-brand-mute">{post.title}</p>
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="overflow-x-auto">
        <div
          className="inline-flex gap-4"
          style={{ minWidth: `${responses.length * 280 + 200}px` }}
        >
          {/* Labels column */}
          <div className="w-[180px] shrink-0 space-y-4 pt-[140px]">
            <div className="flex h-[60px] items-center text-sm font-medium text-brand-mute">
              Total Price
            </div>
            <div className="flex h-[60px] items-center text-sm font-medium text-brand-mute">
              Deposit
            </div>
            <div className="flex h-[60px] items-center text-sm font-medium text-brand-mute">
              Dates
            </div>
            <div className="flex h-[60px] items-center text-sm font-medium text-brand-mute">
              Guests
            </div>
            <div className="flex h-[60px] items-center text-sm font-medium text-brand-mute">
              Quote Status
            </div>
            <div className="flex h-[60px] items-center text-sm font-medium text-brand-mute">
              Expires
            </div>
            <div className="flex h-auto items-start pt-2 text-sm font-medium text-brand-mute">
              Notes
            </div>
          </div>

          {/* Quote columns */}
          {responses.map((response) => {
            const host = response.host as unknown as {
              id: string;
              display_name: string;
              logo_url: string | null;
              bio: string | null;
            } | null;
            const quote = response.quote as unknown as {
              id: string;
              total_amount: number;
              currency: string;
              status: string;
              valid_until: string | null;
              check_in: string | null;
              check_out: string | null;
              headcount: number | null;
              deposit_amount: number | null;
              notes: string | null;
            } | null;

            const totalGuests = quote?.headcount ?? 0;

            const isExpired =
              quote?.valid_until && new Date(quote.valid_until) < new Date();

            return (
              <div
                key={response.id}
                className="w-[260px] shrink-0 rounded-card border border-brand-line bg-white"
              >
                {/* Host header */}
                <div className="border-b border-brand-line p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light font-medium text-brand-mute">
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
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-brand-ink">
                        {host?.display_name ?? "Host"}
                      </h3>
                      <p className="text-xs text-brand-mute">
                        Sent {formatDistanceToNow(new Date(response.sent_at))}
                      </p>
                    </div>
                  </div>
                  {host?.bio && (
                    <p className="mt-2 line-clamp-2 text-xs text-brand-mute">
                      {host.bio}
                    </p>
                  )}
                </div>

                {/* Quote details */}
                <div className="space-y-4 p-4">
                  {/* Total Price */}
                  <div className="flex h-[60px] items-center">
                    <span className="text-xl font-bold text-brand-ink">
                      {quote?.currency === "ZAR" ? "R" : quote?.currency}
                      {quote?.total_amount.toLocaleString() ?? "–"}
                    </span>
                  </div>

                  {/* Deposit */}
                  <div className="flex h-[60px] items-center">
                    <span className="text-sm text-brand-ink">
                      {quote?.deposit_amount
                        ? `R${quote.deposit_amount.toLocaleString()}`
                        : "–"}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="flex h-[60px] items-center">
                    <span className="text-sm text-brand-ink">
                      {quote?.check_in && quote?.check_out
                        ? `${new Date(quote.check_in).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${new Date(quote.check_out).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                        : "–"}
                    </span>
                  </div>

                  {/* Guests */}
                  <div className="flex h-[60px] items-center">
                    <span className="text-sm text-brand-ink">
                      {totalGuests > 0
                        ? `${totalGuests} guest${totalGuests !== 1 ? "s" : ""}`
                        : "–"}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex h-[60px] items-center">
                    <QuoteStatusBadge status={quote?.status ?? "sent"} />
                  </div>

                  {/* Expires */}
                  <div className="flex h-[60px] items-center">
                    <span
                      className={`text-sm ${isExpired ? "text-red-600" : "text-brand-mute"}`}
                    >
                      {quote?.valid_until
                        ? isExpired
                          ? "Expired"
                          : new Date(quote.valid_until).toLocaleDateString(
                              "en-ZA",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )
                        : "No expiry"}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="min-h-[60px]">
                    <p className="line-clamp-3 text-sm text-brand-mute">
                      {quote?.notes || "No notes"}
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="border-t border-brand-line p-4">
                  <Button className="w-full" asChild>
                    <Link href={`/portal/quotes/${quote?.id}`}>
                      View Full Quote
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuoteStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-700",
    viewed: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    declined: "bg-red-100 text-red-700",
    expired: "bg-amber-100 text-amber-700",
  };

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.sent}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
