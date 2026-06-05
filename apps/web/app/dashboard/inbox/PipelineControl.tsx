"use client";

import { ArrowRight, Clock, Eye, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import {
  setFollowUpAction,
  setPipelineStageAction,
  type PipelineStage,
} from "./actions";

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: "new_quote", label: "New quote" },
  { key: "quote_sent", label: "Quote sent" },
  { key: "negotiating", label: "Negotiating" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
  { key: "lost", label: "Lost" },
];

export type ThreadQuote = {
  id: string;
  status: string;
  quoteNumber: string | null;
  total: number;
  currency: string;
  validUntil: string | null;
  viewCount: number;
  lastViewedAt: string | null;
};

function expiryLabel(iso: string): { text: string; expired: boolean } {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "Expired", expired: true };
  if (days === 0) return { text: "Expires today", expired: false };
  return { text: `Expires in ${days}d`, expired: false };
}

export function PipelineControl({
  conversationId,
  stage,
  quote,
  followUpAt,
}: {
  conversationId: string;
  stage: PipelineStage | null;
  quote: ThreadQuote | null;
  followUpAt: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Optimistic stage so the chip highlights instantly; it reconciles to the
  // server value once the action + refresh settle. (router.refresh refetches
  // the whole inbox RSC, which is the slow part — this masks that latency.)
  const [optimisticStage, setOptimisticStage] = useOptimistic(stage);

  function move(next: PipelineStage) {
    if (next === optimisticStage) return;
    start(async () => {
      setOptimisticStage(next);
      const r = await setPipelineStageAction(conversationId, next);
      if (r.ok) {
        toast.success(`Moved to ${STAGES.find((s) => s.key === next)?.label}`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function snooze(days: number | null) {
    if (pending) return;
    const at =
      days == null
        ? null
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + days);
            return d.toISOString();
          })();
    start(async () => {
      const r = await setFollowUpAction(conversationId, at);
      if (r.ok) {
        toast.success(at ? "Reminder set" : "Reminder cleared");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="border-b border-brand-line px-5 py-5">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        Pipeline
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </div>

      {/* Stage chips */}
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => {
          const active = s.key === optimisticStage;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => move(s.key)}
              className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                active
                  ? "bg-brand-primary text-white"
                  : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Follow-up reminder */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-brand-mute">Follow up:</span>
        {followUpAt ? (
          <>
            <span className="font-medium text-brand-ink">
              {new Date(followUpAt).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
              })}
            </span>
            <button
              type="button"
              onClick={() => snooze(null)}
              disabled={pending}
              className="rounded-pill border border-brand-line px-2 py-0.5 font-medium text-brand-mute hover:bg-brand-light disabled:opacity-60"
            >
              Clear
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => snooze(1)}
              disabled={pending}
              className="rounded-pill border border-brand-line px-2 py-0.5 font-medium text-brand-mute hover:bg-brand-light disabled:opacity-60"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => snooze(3)}
              disabled={pending}
              className="rounded-pill border border-brand-line px-2 py-0.5 font-medium text-brand-mute hover:bg-brand-light disabled:opacity-60"
            >
              In 3 days
            </button>
          </>
        )}
      </div>

      {/* Linked quote card */}
      {quote ? (
        <div className="mt-4 rounded-[12px] border border-brand-line bg-brand-light/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <FileText className="h-3.5 w-3.5" />
              {quote.status === "draft"
                ? "Draft quote"
                : `Quote · ${quote.status}`}
            </div>
            <span className="num font-display text-[15px] font-bold text-brand-ink">
              {formatMoney(quote.total, quote.currency)}
            </span>
          </div>
          {quote.quoteNumber ? (
            <div className="num mt-0.5 font-mono text-[11px] text-brand-mute">
              {quote.quoteNumber}
            </div>
          ) : null}
          {(quote.status === "sent" && quote.validUntil) ||
          quote.viewCount > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {quote.status === "sent" && quote.validUntil
                ? (() => {
                    const e = expiryLabel(quote.validUntil);
                    return (
                      <span
                        className={`inline-flex items-center gap-1 ${e.expired ? "text-status-cancelled" : "text-brand-mute"}`}
                      >
                        <Clock className="h-3 w-3" /> {e.text}
                      </span>
                    );
                  })()
                : null}
              {quote.viewCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-brand-secondary">
                  <Eye className="h-3 w-3" /> Seen {quote.viewCount}×
                </span>
              ) : null}
            </div>
          ) : null}
          <Link
            href={`/dashboard/quotes/${quote.id}`}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            {quote.status === "draft" ? "Complete & send quote" : "View quote"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
