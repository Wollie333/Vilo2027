"use server";

import { revalidatePath } from "next/cache";

import { sendTransactionalEmail } from "@/lib/email/send";
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

/**
 * Send the booking's payment link into the guest's inbox thread as a rich
 * PAYMENT CARD (booking summary + amount + a Pay button). Unlike the generic
 * document-link sender, this CREATES the host<->guest thread when none exists
 * yet, so a host can always drop a pay link into chat. The card data rides on
 * the message itself: a human-readable `body` (also the conversation preview)
 * plus the public pay URL in `attachment_url` (consumed by the thread card).
 */
export async function sendPaymentLinkToThreadAction(input: {
  bookingId: string;
  url: string;
  reference: string;
  listingName: string;
  amountLabel: string;
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
    return { ok: false, error: "Invalid payment link." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, host_id, guest_id, property_id")
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

  // Find the existing host<->guest thread, or CREATE one so the host can always
  // send a pay link (the reported "no thread" case).
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", host.id)
    .eq("guest_id", booking.guest_id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  let conversationId = conv?.id ?? null;
  if (!conversationId) {
    const { data: created, error: convErr } = await admin
      .from("conversations")
      .insert({
        host_id: host.id,
        guest_id: booking.guest_id,
        property_id: booking.property_id,
        is_enquiry: false,
        status: "open",
      })
      .select("id")
      .single();
    if (convErr || !created) {
      return { ok: false, error: "Couldn't start a thread with this guest." };
    }
    conversationId = created.id;
  }

  // Post the payment card. body = readable summary (also the list preview);
  // attachment_url carries the public pay URL the card's Pay button links to.
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    is_system_message: true,
    system_event: "payment_link",
    body: `Payment link · ${input.amountLabel} due for booking ${input.reference} at ${input.listingName}`,
    attachment_url: input.url,
    read_by_host: true,
  });
  if (error) return { ok: false, error: "Couldn't send the payment link." };

  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

/**
 * Email a financial document's public link straight to the guest's email
 * address (works even for account-less guests, unlike the inbox link). Host
 * ownership verified; sends via the app's transactional email.
 */
export async function emailDocumentToGuestAction(input: {
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
    .select("id, host_id, guest_id, guest_name, guest_email")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.host_id !== host.id) {
    return { ok: false, error: "Not your booking." };
  }

  let to = booking.guest_email ?? null;
  if (!to && booking.guest_id) {
    const { data: gp } = await admin
      .from("user_profiles")
      .select("email")
      .eq("id", booking.guest_id)
      .maybeSingle();
    to = gp?.email ?? null;
  }
  if (!to) {
    return { ok: false, error: "This guest has no email on file." };
  }

  const name = (booking.guest_name ?? "there").split(" ")[0] || "there";
  const res = await sendTransactionalEmail({
    to,
    subject: `Your ${input.label}`,
    html: `<p>Hi ${name},</p><p>Here's your ${input.label}:</p><p><a href="${input.url}">${input.url}</a></p><p>Thank you for booking direct.</p>`,
  });
  if (!res.ok) {
    return { ok: false, error: res.error ?? "Couldn't send the email." };
  }
  return { ok: true };
}
