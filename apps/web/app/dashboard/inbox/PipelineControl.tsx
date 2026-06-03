"use client";

import { ArrowRight, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setPipelineStageAction, type PipelineStage } from "./actions";

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
};

function fmt(total: number, currency: string): string {
  const sym = currency === "ZAR" ? "R " : `${currency} `;
  return `${sym}${Math.round(total).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

export function PipelineControl({
  conversationId,
  stage,
  quote,
}: {
  conversationId: string;
  stage: PipelineStage | null;
  quote: ThreadQuote | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function move(next: PipelineStage) {
    if (pending || next === stage) return;
    start(async () => {
      const r = await setPipelineStageAction(conversationId, next);
      if (r.ok) {
        toast.success(`Moved to ${STAGES.find((s) => s.key === next)?.label}`);
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
          const active = s.key === stage;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => move(s.key)}
              disabled={pending}
              className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-60 ${
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
              {fmt(quote.total, quote.currency)}
            </span>
          </div>
          {quote.quoteNumber ? (
            <div className="num mt-0.5 font-mono text-[11px] text-brand-mute">
              {quote.quoteNumber}
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
