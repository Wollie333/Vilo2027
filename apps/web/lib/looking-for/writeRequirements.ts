import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Replace a post's requirement selections with the given option keys. Delete-all
// then insert (mirrors replaceAmenitiesAction). Each key is resolved against the
// published options catalog so the join row denormalises label + group slug and
// links option_id (loosely — ON DELETE SET NULL). Unknown/unpublished keys are
// dropped. Runs with the service role; the caller verifies post ownership.
export async function replacePostRequirements(
  postId: string,
  keys: string[],
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("looking_for_post_requirements")
    .delete()
    .eq("post_id", postId);

  const unique = Array.from(new Set((keys ?? []).filter(Boolean)));
  if (unique.length === 0) return;

  const { data: options } = await admin
    .from("looking_for_requirement_options")
    .select(
      "id, slug, label, is_published, group:looking_for_requirement_groups(slug)",
    )
    .in("slug", unique)
    .is("deleted_at", null);

  const rows = (options ?? [])
    .filter((o) => o.is_published)
    .map((o) => {
      const group = Array.isArray(o.group) ? o.group[0] : o.group;
      return {
        post_id: postId,
        option_key: o.slug,
        option_label: o.label,
        group_slug: group?.slug ?? null,
        option_id: o.id,
      };
    });

  if (rows.length > 0) {
    await admin.from("looking_for_post_requirements").insert(rows);
  }
}
