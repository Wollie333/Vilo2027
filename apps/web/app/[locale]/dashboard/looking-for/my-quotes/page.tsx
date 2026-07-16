import { redirect } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Calendar,
  Clock,
  Eye,
  MapPin,
  SendHorizonal,
  Zap,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { hostHasFeature } from "@/lib/products/featureGate";
import { LookingForLocked } from "../_components/LookingForLocked";

export default async function MyQuotesSentPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/looking-for/my-quotes");
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    redirect("/dashboard");
  }

  const canLookingFor = await hostHasFeature(host.id, "looking_for_access");

  if (!canLookingFor) {
    return (
      <div className="space-y-6">
        <MyQuotesHeader
          stats={{
            totalQuotes: 0,
            avgResponseHours: 0,
            acceptanceRate: 0,
            viewRate: 0,
          }}
        />
        <LookingForLocked />
      </div>
    );
  }

  // Fetch quotes the host has sent on Looking For posts
  const { data: responses } = await supabase
    .from("looking_for_responses")
    .select(
      `
      id,
      status,
      sent_at,
      viewed_at,
      post:looking_for_posts(
        id,
        title,
        category,
        check_in_date,
        check_out_date,
        location_text,
        status,
        created_at
      ),
      quote:quotes(
        id,
        total_amount,
        currency,
        status
      )
    `,
    )
    .eq("host_id", host.id)
    .order("sent_at", { ascending: false })
    .limit(50);

  // Calculate response time stats
  const responseStats = calculateResponseStats(responses ?? []);

  return (
    <div className="space-y-6">
      <MyQuotesHeader stats={responseStats} />

      {!responses || responses.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
            <SendHorizonal className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No quotes sent yet
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            When you send quotes to guest requests, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map((response) => {
            const post = response.post as unknown as {
              title: string;
              location_text: string | null;
              check_in_date: string | null;
              check_out_date: string | null;
            } | null;
            // Supabase can return an embedded to-one as an array — normalise.
            const quoteRaw = response.quote as unknown;
            const quote = (
              Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw
            ) as {
              id: string;
              total_amount: number | null;
              currency: string | null;
            } | null;
            const sent = new Date(response.sent_at).toLocaleDateString(
              "en-ZA",
              {
                day: "numeric",
                month: "short",
                year: "numeric",
              },
            );
            const dates =
              post?.check_in_date && post?.check_out_date
                ? `${fmtShort(post.check_in_date)} – ${fmtShort(post.check_out_date)}`
                : null;

            const Body = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-[15px] font-semibold text-brand-ink">
                      {post?.title ?? "Unknown request"}
                    </h3>
                    <StatusBadge status={response.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-brand-mute">
                    {post?.location_text ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{post.location_text}</span>
                      </span>
                    ) : null}
                    {dates ? (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {dates}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      Sent {sent}
                    </span>
                    {response.viewed_at ? (
                      <span className="flex items-center gap-1.5 text-brand-primary">
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        Seen
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {quote?.total_amount != null ? (
                    <span className="flex items-center gap-1.5 font-display text-[15px] font-bold text-brand-ink">
                      <Banknote className="h-4 w-4 text-brand-mute" />
                      {formatMoney(quote.total_amount, quote.currency ?? "ZAR")}
                    </span>
                  ) : null}
                  {quote?.id ? (
                    <ArrowRight className="h-4 w-4 text-brand-mute" />
                  ) : null}
                </div>
              </>
            );

            const cls =
              "flex items-center justify-between gap-4 rounded-card border border-brand-line bg-white p-4 shadow-card transition";
            return quote?.id ? (
              <Link
                key={response.id}
                href={`/dashboard/quotes/${quote.id}`}
                className={`${cls} hover:border-brand-primary/40 hover:shadow-lift`}
              >
                {Body}
              </Link>
            ) : (
              <div key={response.id} className={cls}>
                {Body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ResponseStats {
  totalQuotes: number;
  avgResponseHours: number;
  acceptanceRate: number;
  viewRate: number;
}

function MyQuotesHeader({ stats }: { stats: ResponseStats }) {
  const avgTimeDisplay = formatResponseTime(stats.avgResponseHours);
  const isQuickResponder =
    stats.avgResponseHours > 0 && stats.avgResponseHours < 4;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <SendHorizonal className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-brand-ink">
            My Quotes Sent
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Track quotes you&apos;ve sent in response to guest requests
          </p>
        </div>
      </div>

      {stats.totalQuotes > 0 && (
        <div className="flex flex-wrap gap-3">
          {/* Average Response Time Badge */}
          <div className="flex items-center gap-2 rounded-full border border-brand-line bg-white px-3 py-1.5">
            <Clock className="h-4 w-4 text-brand-mute" />
            <span className="text-sm text-brand-ink">
              Avg response:{" "}
              <span className="font-medium">{avgTimeDisplay}</span>
            </span>
            {isQuickResponder && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <Zap className="h-3 w-3" />
                Quick
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 rounded-full border border-brand-line bg-white px-3 py-1.5 text-sm text-brand-mute">
            {stats.viewRate > 0 && (
              <span>{stats.viewRate.toFixed(0)}% viewed</span>
            )}
            {stats.viewRate > 0 && stats.acceptanceRate > 0 && (
              <span className="text-brand-line">·</span>
            )}
            {stats.acceptanceRate > 0 && (
              <span className="font-medium text-green-600">
                {stats.acceptanceRate.toFixed(0)}% accepted
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function calculateResponseStats(
  responses: Array<{
    sent_at: string;
    status: string;
    viewed_at: string | null;
    post: unknown;
  }>,
): ResponseStats {
  if (responses.length === 0) {
    return {
      totalQuotes: 0,
      avgResponseHours: 0,
      acceptanceRate: 0,
      viewRate: 0,
    };
  }

  let totalResponseHours = 0;
  let responseCount = 0;
  let viewedCount = 0;
  let acceptedCount = 0;

  for (const response of responses) {
    // Calculate response time (from post created to quote sent)
    const post = response.post as { created_at?: string } | null;
    if (post?.created_at && response.sent_at) {
      const postCreated = new Date(post.created_at).getTime();
      const quoteSent = new Date(response.sent_at).getTime();
      const diffHours = (quoteSent - postCreated) / (1000 * 60 * 60);
      if (diffHours > 0 && diffHours < 720) {
        // Ignore if > 30 days
        totalResponseHours += diffHours;
        responseCount++;
      }
    }

    if (response.viewed_at) viewedCount++;
    if (response.status === "accepted") acceptedCount++;
  }

  return {
    totalQuotes: responses.length,
    avgResponseHours:
      responseCount > 0 ? totalResponseHours / responseCount : 0,
    acceptanceRate: (acceptedCount / responses.length) * 100,
    viewRate: (viewedCount / responses.length) * 100,
  };
}

function formatResponseTime(hours: number): string {
  if (hours === 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function fmtShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function StatusBadge({ status }: { status: string }) {
  // Design-system status tokens (matches the guest quote list + thread card).
  const styles: Record<string, string> = {
    sent: "border-brand-line bg-brand-light text-brand-mute",
    viewed: "border-brand-accent bg-brand-accent/40 text-brand-secondary",
    accepted:
      "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed",
    declined:
      "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled",
    expired: "border-brand-line bg-brand-light text-brand-mute",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${styles[status] ?? styles.sent}`}
    >
      {status}
    </span>
  );
}
