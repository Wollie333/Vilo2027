"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";

import { voteOnArticle } from "../actions";

type Props = {
  articleId: string;
  initial: { helpful: number; not_helpful: number };
};

export function ArticleFeedback({ articleId, initial }: Props) {
  const [counts, setCounts] = useState(initial);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(vote: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const res = await voteOnArticle({ articleId, vote });
      if (res.ok) {
        setCounts({ helpful: res.helpful, not_helpful: res.not_helpful });
        setVoted(vote);
      } else {
        setError(res.error);
      }
    });
  }

  const total = counts.helpful + counts.not_helpful;
  const pct = total > 0 ? Math.round((counts.helpful / total) * 100) : null;

  return (
    <div className="rounded-card border border-brand-line bg-brand-light/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-brand-ink">
          Was this helpful?
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => send("up")}
            disabled={pending || voted === "up"}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              voted === "up"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" /> Yes
          </button>
          <button
            type="button"
            onClick={() => send("down")}
            disabled={pending || voted === "down"}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              voted === "down"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
            }`}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> No
          </button>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-brand-mute">
        {pct !== null
          ? `${pct}% of ${total} readers found this helpful`
          : "Be the first to rate this article"}
      </div>
      {error ? (
        <div className="mt-2 text-[11px] text-red-700">{error}</div>
      ) : null}
    </div>
  );
}
