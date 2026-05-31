"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

export type ExtrasResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// All writes go through the user-scoped client, so the host_manage_* RLS
// policies enforce that the listing belongs to the signed-in host. No extra
// ownership check needed here. Feature gates (neighbourhood / review_themes)
// are seeded open on every plan pre-MVP (AGENT_RULES §3.4).

const poiSchema = z.object({
  listing_id: z.string().uuid(),
  category: z.enum(["eat", "do", "travel"]),
  name: z.string().trim().min(1, "Add a name.").max(120),
  travel_time: z.string().trim().max(40).optional().nullable(),
});

const themeSchema = z.object({
  listing_id: z.string().uuid(),
  label: z.string().trim().min(1, "Add a label.").max(60),
  icon_key: z.string().trim().min(1).max(40).default("sparkles"),
  mention_count: z.number().int().min(0).max(100000).nullable().optional(),
});

export async function createPoiAction(
  input: z.infer<typeof poiSchema>,
): Promise<ExtrasResult<{ id: string }>> {
  const parsed = poiSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("listing_points_of_interest")
    .insert({
      listing_id: parsed.data.listing_id,
      category: parsed.data.category,
      name: parsed.data.name,
      travel_time: parsed.data.travel_time || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not add. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: { id: data.id } };
}

export async function deletePoiAction(id: string): Promise<ExtrasResult> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_points_of_interest")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not remove. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: undefined };
}

export async function createThemeAction(
  input: z.infer<typeof themeSchema>,
): Promise<ExtrasResult<{ id: string }>> {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("listing_review_themes")
    .insert({
      listing_id: parsed.data.listing_id,
      label: parsed.data.label,
      icon_key: parsed.data.icon_key,
      mention_count: parsed.data.mention_count ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not add. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: { id: data.id } };
}

export async function deleteThemeAction(id: string): Promise<ExtrasResult> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_review_themes")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not remove. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: undefined };
}
