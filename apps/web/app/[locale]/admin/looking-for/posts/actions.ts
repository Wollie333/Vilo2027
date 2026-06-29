"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function flagPostAction(postId: string) {
  await requirePermission("platform.features");

  const service = createAdminClient();

  const { error } = await service
    .from("looking_for_posts")
    .update({ status: "flagged", updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    console.error("Failed to flag post:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/looking-for/posts");
  return { success: true };
}

export async function unflagPostAction(postId: string) {
  await requirePermission("platform.features");

  const service = createAdminClient();

  const { error } = await service
    .from("looking_for_posts")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    console.error("Failed to unflag post:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/looking-for/posts");
  return { success: true };
}

export async function removePostAction(postId: string) {
  await requirePermission("platform.features");

  const service = createAdminClient();

  const { error } = await service
    .from("looking_for_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    console.error("Failed to remove post:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/looking-for/posts");
  return { success: true };
}

export async function reinstatePostAction(postId: string) {
  await requirePermission("platform.features");

  const service = createAdminClient();

  // Set back to active and extend expiry by 7 days from now
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 7);

  const { error } = await service
    .from("looking_for_posts")
    .update({
      status: "active",
      expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) {
    console.error("Failed to reinstate post:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/looking-for/posts");
  return { success: true };
}
