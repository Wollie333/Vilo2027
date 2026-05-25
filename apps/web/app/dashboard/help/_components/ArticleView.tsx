"use client";

import { useEffect } from "react";

import { trackArticleView } from "../actions";

const SESSION_KEY = "vilo:help-viewed";

export function ArticleView({ articleId }: { articleId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      if (seen.has(articleId)) return;
      seen.add(articleId);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen]));
      void trackArticleView({ articleId });
    } catch {
      // sessionStorage may be unavailable.
    }
  }, [articleId]);
  return null;
}
