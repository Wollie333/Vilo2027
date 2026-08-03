import { randomUUID } from "node:crypto";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { ArticleEditor } from "../_components/ArticleEditor";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function NewHelpArticlePage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const { data: categories } = await service
    .from("help_categories")
    .select("id, name, slug")
    .is("deleted_at", null)
    .eq("is_published", true)
    .order("sort_order");

  // "Draft article" from a reader suggestion — prefill the editor with their
  // request so the writer starts from the actual question.
  let prefillTitle = "";
  let prefillExcerpt = "";
  let prefillBody = "";
  const fromId = searchParams?.from;
  if (fromId && UUID_RE.test(fromId)) {
    const { data: sug } = await service
      .from("help_article_suggestions")
      .select("message")
      .eq("id", fromId)
      .maybeSingle();
    const message = (sug as { message?: string } | null)?.message?.trim();
    if (message) {
      prefillTitle = message.slice(0, 120);
      prefillExcerpt = message.slice(0, 200);
      prefillBody =
        `<p><em>Reader asked:</em> ${escapeHtml(message)}</p>` +
        `<p>Write the answer here…</p>`;
    }
  }

  // A fresh id for the new article, generated server-side. (Previously a client
  // component supplied this via a function-as-children render prop, which is an
  // illegal Server→Client boundary and threw on load once Help was un-hidden.)
  return (
    <ArticleEditor
      mode="create"
      defaults={{
        id: randomUUID(),
        title: prefillTitle,
        slug: "",
        excerpt: prefillExcerpt,
        bodyHtml: prefillBody,
        bodyJson: { type: "doc", content: [] },
        categoryId: null,
        audience: "both",
        status: "draft",
        featuredRank: null,
        readTimeMinutes: 4,
        hasVideo: false,
        seoTitle: "",
        metaDescription: "",
        ogImageUrl: "",
        isDeleted: false,
      }}
      categories={
        (categories ?? []) as { id: string; name: string; slug: string }[]
      }
    />
  );
}
