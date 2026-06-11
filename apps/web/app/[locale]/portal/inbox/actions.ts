"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type GuestActionResult =
  | { ok: true; data?: { id: string } }
  | { ok: false; error: string };

const sendSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1, "Type a message.").max(4000),
});

// Guest sends a message in their own conversation. RLS (guest_manage_conv /
// participant_access_msg) scopes everything to guest_id = auth.uid(); we also
// verify ownership for a friendly error.
async function ownsConversation(
  supabase: ReturnType<typeof createServerClient>,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("guest_id", userId)
    .maybeSingle();
  return !!data;
}

export async function sendGuestMessageAction(
  input: z.infer<typeof sendSchema>,
): Promise<GuestActionResult> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Message looks wrong.",
    };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (
    !(await ownsConversation(supabase, parsed.data.conversation_id, user.id))
  ) {
    return { ok: false, error: "Not your conversation." };
  }

  const { data: row, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversation_id,
      sender_id: user.id,
      body: parsed.data.body,
      read_by_guest: true,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: "Could not send message. Try again." };
  }

  // A guest reply on a live enquiry means the deal is in motion — auto-advance
  // the host's pipeline to "negotiating" (label only; doesn't touch the deal).
  const { data: conv } = await supabase
    .from("conversations")
    .select("is_enquiry, pipeline_stage, status")
    .eq("id", parsed.data.conversation_id)
    .maybeSingle();
  if (
    conv?.is_enquiry &&
    conv.status !== "archived" &&
    (conv.pipeline_stage === "new_quote" ||
      conv.pipeline_stage === "quote_sent")
  ) {
    await createAdminClient()
      .from("conversations")
      .update({ pipeline_stage: "negotiating" })
      .eq("id", parsed.data.conversation_id);
  }

  revalidatePath(`/portal/inbox/${parsed.data.conversation_id}`);
  revalidatePath("/portal/inbox");
  return { ok: true, data: { id: row.id } };
}

export async function markGuestConversationReadAction(
  conversationId: string,
): Promise<GuestActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!(await ownsConversation(supabase, conversationId, user.id))) {
    return { ok: false, error: "Not your conversation." };
  }

  await supabase
    .from("messages")
    .update({ read_by_guest: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("read_by_guest", false);
  await supabase
    .from("conversations")
    .update({ unread_guest: 0, guest_last_seen_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath("/portal/inbox");
  return { ok: true };
}

// Mark the guest "online" for delivery receipts: stamp guest_last_seen_at across
// their conversations so the host's outgoing messages flip from sent → delivered.
// Called when the guest opens their inbox and when a new message arrives live.
export async function touchGuestSeenAction(): Promise<GuestActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("conversations")
    .update({ guest_last_seen_at: new Date().toISOString() })
    .eq("guest_id", user.id);
  if (error) return { ok: false, error: "Could not update presence." };
  return { ok: true };
}
