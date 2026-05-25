"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const upsertSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(5).max(280),
  answerHtml: z.string().min(5),
  categoryId: z.string().uuid().nullable().default(null),
  audience: z.enum(["host", "guest", "both"]),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
  isPublished: z.boolean(),
  isCreate: z.boolean(),
  reason: z.string().optional(),
});

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const upsertHelpFaqAction = withAdminAudit<
  z.infer<typeof upsertSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.faq.upsert",
    targetType: "help_faq",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const payload = {
      question: args.question.trim(),
      answer_html: args.answerHtml,
      category_id: args.categoryId,
      audience: args.audience,
      is_featured: args.isFeatured,
      sort_order: args.sortOrder,
      is_published: args.isPublished,
    };
    if (args.isCreate) {
      const { data, error } = await service
        .from("help_faqs")
        .insert({ id: args.id, ...payload })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      revalidatePath("/admin/help/faqs");
      revalidatePath("/dashboard/help");
      revalidatePath("/help");
      return {
        result: { ok: true, id: (data as { id: string }).id },
        after: data,
      };
    }
    const { data, error } = await service
      .from("help_faqs")
      .update(payload)
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/faqs");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return {
      result: { ok: true, id: (data as { id: string }).id },
      after: data,
    };
  },
);

export const deleteHelpFaqAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.faq.delete",
    targetType: "help_faq",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("help_faqs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/faqs");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true }, after: data };
  },
);

export async function saveHelpFaq(input: {
  id?: string;
  question: string;
  answerHtml: string;
  categoryId: string | null;
  audience: "host" | "guest" | "both";
  isFeatured: boolean;
  sortOrder: number;
  isPublished: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000");
  const parsed = upsertSchema.safeParse({ ...input, id, isCreate: !input.id });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const res = await upsertHelpFaqAction(parsed.data);
    if (res.ok) return res;
    return { ok: false, error: "Save failed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteHelpFaq(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteHelpFaqAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
