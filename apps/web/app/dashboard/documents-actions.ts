"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type SendDocumentResult = { ok: true } | { ok: false; error: string };

/**
 * Send a financial document's public link to the guest's inbox thread — used by
 * the Send button on invoice / quote / credit-note / receipt record pages. The
 * caller passes the already-built public URL (origin + token path). Posts into
 * the existing host<->guest conversation (account guests); account-less guests
 * get a clear error so the host falls back to email / WhatsApp.
 */
export async function sendDocumentLinkAction(input: {
  bookingId: string;
  url: string;
  label: string;
}): Promise<SendDocumentResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };

  if (!/^https?:\/\//.test(input.url)) {
    return { ok: false, error: "Invalid document link." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, host_id, guest_id")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.host_id !== host.id) {
    return { ok: false, error: "Not your booking." };
  }
  if (!booking.guest_id) {
    return {
      ok: false,
      error: "This guest has no account — share the link by email or WhatsApp.",
    };
  }

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", host.id)
    .eq("guest_id", booking.guest_id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!conv) {
    return {
      ok: false,
      error: "No inbox thread with this guest yet — message them first.",
    };
  }

  const { error } = await admin.from("messages").insert({
    conversation_id: conv.id,
    sender_id: user.id,
    body: `Here's your ${input.label}: ${input.url}`,
    read_by_host: true,
  });
  if (error) return { ok: false, error: "Couldn't send the link." };

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}
