"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "planned", "shipped", "dismissed"]),
  reason: z.string().optional(),
});

export const updateSuggestionAction = withAdminAudit<
  z.infer<typeof updateSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.suggestion.update",
    targetType: "help_article_suggestion",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const resolved = args.status === "open" ? null : new Date().toISOString();
    const { data, error } = await service
      .from("help_article_suggestions")
      .update({ status: args.status, resolved_at: resolved })
      .eq("id", args.id)
      .select("id, status, resolved_at")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/suggestions");
    return { result: { ok: true }, after: data };
  },
);

export async function updateSuggestionStatus(input: {
  id: string;
  status: "open" | "planned" | "shipped" | "dismissed";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await updateSuggestionAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
