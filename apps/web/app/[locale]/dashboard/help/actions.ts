"use server";

import { z } from "zod";

import { CONTACT_EMAIL } from "@/lib/contact";
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

const saveSchema = z.object({
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
      error: `Sign in to submit a suggestion, or email it to ${CONTACT_EMAIL}.`,
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

export async function toggleSaveArticle(input: {
  articleId: string;
}): Promise<
  | { ok: true; saved: boolean; saved_count: number }
  | { ok: false; error: string; needsAuth?: boolean }
> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to save articles.", needsAuth: true };
  }

  const articleId = parsed.data.articleId;

  const { data: existing } = await supabase
    .from("help_article_saves")
    .select("id")
    .eq("article_id", articleId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("help_article_saves")
      .delete()
      .eq("article_id", articleId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("help_article_saves")
      .insert({ article_id: articleId, user_id: user.id });
    // 23505 = unique violation (double-click race) — already saved, not an error.
    if (error && error.code !== "23505") {
      return { ok: false, error: error.message };
    }
  }

  // Read the counter back after the trigger has run (separate request = the
  // insert/delete has already committed).
  const { data: article } = await supabase
    .from("help_articles")
    .select("saved_count")
    .eq("id", articleId)
    .maybeSingle();

  return {
    ok: true,
    saved: !existing,
    saved_count: Number(
      (article as { saved_count?: number } | null)?.saved_count ?? 0,
    ),
  };
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
