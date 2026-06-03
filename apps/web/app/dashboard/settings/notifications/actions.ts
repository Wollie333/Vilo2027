"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

export type AutoReplyResult = { ok: true } | { ok: false; error: string };

// Set (or clear) the host's enquiry "away" auto-reply, posted to new enquiry
// threads that arrive during the host's notification quiet hours.
export async function setEnquiryAutoReplyAction(
  message: string,
): Promise<AutoReplyResult> {
  const text = message.trim();
  if (text.length > 1000) {
    return { ok: false, error: "Keep it under 1000 characters." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // RLS host_manage_own_hosts scopes the update to the caller's host row.
  const { error } = await supabase
    .from("hosts")
    .update({ enquiry_auto_reply: text.length > 0 ? text : null })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not save. Try again." };

  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
}
