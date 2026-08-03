"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleSaveArticle } from "../actions";

type Props = {
  articleId: string;
  initialSaved: boolean;
  initialCount: number;
  isAuthed: boolean;
  loginHref: string;
};

export function SaveArticleButton({
  articleId,
  initialSaved,
  initialCount,
  isAuthed,
  loginHref,
}: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!isAuthed) {
      router.push(loginHref);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await toggleSaveArticle({ articleId });
      if (!res.ok) {
        if (res.needsAuth) {
          router.push(loginHref);
          return;
        }
        setError(res.error);
        return;
      }
      setSaved(res.saved);
      setCount(res.saved_count);
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={saved}
        className={`inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
          saved
            ? "border-brand-primary bg-brand-accent text-brand-secondary"
            : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
        }`}
      >
        {saved ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        {saved ? "Saved" : "Save"}
        {count > 0 ? (
          <span className="num font-mono text-xs text-brand-mute">{count}</span>
        ) : null}
      </button>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
