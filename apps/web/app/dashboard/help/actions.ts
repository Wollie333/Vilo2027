"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const voteSchema = z.object({
  articleId: z.string().uuid(),
  vote: z.enum(["up", "down"]),
});

const suggestionSchema = z.object({
  message: z.string().min(10).max(1000),
});

const viewSchema = z.object({
  articleId: z.string().uuid(),
});

export async function voteOnArticle(input: {
  articleId: string;
  vote: "up" | "down";
}): Promise<
  | { ok: true; helpful: number; not_helpful: number }
  | { ok: false; error: string }
> {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to vote." };
  }

  const { data, error } = await supabase.rpc("vote_help_article", {
    p_article_id: parsed.data.articleId,
    p_vote: parsed.data.vote,
  });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    helpful: Number((row as { helpful_count?: number })?.helpful_count ?? 0),
    not_helpful: Number(
      (row as { not_helpful_count?: number })?.not_helpful_count ?? 0,
    ),
  };
}

export async function submitArticleSuggestion(input: {
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please write at least 10 characters describing what you need.",
    };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error:
        "Sign in to submit a suggestion, or email it to hello@viloplatform.com.",
    };
  }

  const service = createAdminClient();
  const { error } = await service.from("help_article_suggestions").insert({
    user_id: user.id,
    email: user.email ?? null,
    message: parsed.data.message,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function trackArticleView(input: {
  articleId: string;
}): Promise<{ ok: true } | { ok: false }> {
  const parsed = viewSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = createServerClient();
  await supabase.rpc("increment_help_article_view", {
    p_article_id: parsed.data.articleId,
  });
  return { ok: true };
}
