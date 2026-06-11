import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { FaqsEditor } from "./FaqsEditor";

export const dynamic = "force-dynamic";

export default async function AdminHelpFaqsPage() {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const [{ data: faqs }, { data: categories }] = await Promise.all([
    service
      .from("help_faqs")
      .select(
        "id, question, answer_html, category_id, audience, is_featured, sort_order, is_published",
      )
      .is("deleted_at", null)
      .order("sort_order"),
    service
      .from("help_categories")
      .select("id, name")
      .is("deleted_at", null)
      .order("sort_order"),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">FAQs</h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          The accordion on /help. Featured FAQs surface on the home page first.
        </p>
      </header>

      <FaqsEditor
        rows={(faqs ?? []) as Parameters<typeof FaqsEditor>[0]["rows"]}
        categories={(categories ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
