"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

// Admin moderation of a listing. These are platform powers (audited, no host
// support-grant needed): take a policy-violating listing offline, restore it, or
// feature/unfeature it. All gated on `listings.edit`.

type Ok = { ok: true } | { ok: false; error: string };

// ── Publish / unpublish (moderation takedown / restore) ──
const publishSchema = z.object({
  listingId: z.string().uuid(),
  isPublished: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const setListingPublishedAction = withAdminAudit<
  z.infer<typeof publishSchema>,
  { ok: true }
>(
  {
    permissionKey: "listings.edit",
    actionName: "listing.set_published",
    targetType: "listing",
    getTargetId: (a) => a.listingId,
  },
  async (args, service) => {
    const parsed = publishSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error, data } = await service
      .from("properties")
      .update({
        is_published: parsed.data.isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.listingId)
      .is("deleted_at", null)
      .select("id, is_published")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/properties");
    return { result: { ok: true }, after: data };
  },
);

// ── Feature / unfeature ──
const featureSchema = z.object({
  listingId: z.string().uuid(),
  isFeatured: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const setListingFeaturedAction = withAdminAudit<
  z.infer<typeof featureSchema>,
  { ok: true }
>(
  {
    permissionKey: "listings.edit",
    actionName: "listing.set_featured",
    targetType: "listing",
    getTargetId: (a) => a.listingId,
  },
  async (args, service) => {
    const parsed = featureSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error, data } = await service
      .from("properties")
      .update({
        is_featured: parsed.data.isFeatured,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.listingId)
      .is("deleted_at", null)
      .select("id, is_featured")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/properties");
    return { result: { ok: true }, after: data };
  },
);

// ── Thin client wrappers ──
export async function setListingPublished(input: {
  listingId: string;
  isPublished: boolean;
}): Promise<Ok> {
  try {
    await setListingPublishedAction(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function setListingFeatured(input: {
  listingId: string;
  isFeatured: boolean;
}): Promise<Ok> {
  try {
    await setListingFeaturedAction(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
