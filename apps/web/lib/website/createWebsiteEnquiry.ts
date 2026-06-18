import { z } from "zod";

import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { upsertHostContact } from "@/lib/guests/contacts";
import { isSelfRecipient } from "@/lib/host/self";
import { createAdminClient } from "@/lib/supabase/admin";

// Core logic for a public website contact-form submission. A PLAIN server module
// (no "use server") so it can be invoked from a Route Handler — which controls
// its own JSON response — exactly like lib/enquiry/create-enquiry.ts. See
// app/api/website-enquiry/route.ts.
//
// A site visitor sends a message through a host's published website. No login:
// we find-or-create a passwordless guest lead (the SHARED identity SSOT, so it
// also lands in Guests CRM via upsertHostContact — BUSINESS_PRINCIPLES #1), open
// (or reuse) a website-source enquiry conversation in the host's inbox, and drop
// the message in as a "Website Enquiry". If the site's enquiry-email setting is
// on, we also email the submission to the host's chosen address. Runs with the
// service role (the visitor is anonymous).

export const websiteEnquirySchema = z.object({
  website_id: z.string().uuid(),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Enter a message.").max(2000),
  // Honeypot — permissive on the schema (browser autofill must not block a real
  // visitor); a filled value is silently dropped below.
  hp: z.string().optional(),
});

export type WebsiteEnquiryInput = z.infer<typeof websiteEnquirySchema>;

export type WebsiteEnquiryResult =
  | { ok: true; data: { conversationId?: string } }
  | { ok: false; error: string };

const esc = (s: string) =>
  s.replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
  );

export async function createWebsiteEnquiry(
  input: unknown,
): Promise<WebsiteEnquiryResult> {
  const parsed = websiteEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const d = parsed.data;
  const emailLc = d.email.trim().toLowerCase();
  // Honeypot tripped → pretend success, create nothing.
  if (d.hp && d.hp.trim().length > 0) return { ok: true, data: {} };

  const admin = createAdminClient();

  // Resolve the website → host + business + settings + brand.
  const { data: site } = await admin
    .from("host_websites")
    .select("id, host_id, business_id, subdomain, status, settings, brand")
    .eq("id", d.website_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) {
    return {
      ok: false,
      error: "This site isn't accepting messages right now.",
    };
  }

  const { data: hostRow } = await admin
    .from("hosts")
    .select("id, user_id, display_name")
    .eq("id", site.host_id)
    .maybeSingle();
  if (!hostRow) return { ok: false, error: "Host unavailable." };

  // A host can't message their own site (that would open a thread with self).
  if (
    await isSelfRecipient({ userId: hostRow.user_id, recipientEmail: emailLc })
  ) {
    return { ok: false, error: "You can't send a message to your own site." };
  }

  // Blocked sender → silently drop (don't reveal the block).
  const { data: contact } = await admin
    .from("host_contacts")
    .select("id, blocked")
    .eq("host_id", site.host_id)
    .ilike("email", emailLc)
    .maybeSingle();
  if (contact?.blocked) return { ok: true, data: {} };

  // Find-or-create the guest through the shared identity SSOT.
  const identity = await findOrCreateLeadIdentity(admin, {
    email: emailLc,
    name: d.name,
    phone: d.phone || null,
  });
  if (!identity) {
    return { ok: false, error: "Could not send your message. Try again." };
  }
  const { guestId } = identity;

  // Light rate-limit: cap messages from this guest in this host's website threads
  // to 8/hour so a single visitor can't flood the inbox. Silently absorb extras.
  const { count: recent } = await admin
    .from("messages")
    .select("id, conversations!inner(host_id, source)", {
      count: "exact",
      head: true,
    })
    .eq("sender_id", guestId)
    .eq("conversations.host_id", site.host_id)
    .eq("conversations.source", "website")
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((recent ?? 0) >= 8) return { ok: true, data: {} };

  // Upsert the host's contact row through the one canonical writer (find-or-
  // update by email, back-fill guest_id, never duplicate). Fill-only.
  await upsertHostContact(admin, {
    hostId: site.host_id,
    email: emailLc,
    name: d.name,
    phone: d.phone || null,
    guestId,
    lastStage: "new_enquiry",
  });

  // Find-or-create a website-source enquiry conversation (general — not tied to a
  // property). pipeline_stage stays NULL: a website enquiry isn't a quote pipeline
  // item; the inbox surfaces it via is_enquiry + source='website'.
  let conversationId: string;
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", site.host_id)
    .eq("guest_id", guestId)
    .eq("source", "website")
    .is("property_id", null)
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (conv) {
    conversationId = conv.id;
  } else {
    const { data: newConv, error: convErr } = await admin
      .from("conversations")
      .insert({
        host_id: site.host_id,
        guest_id: guestId,
        property_id: null,
        is_enquiry: true,
        source: "website",
        status: "open",
      })
      .select("id")
      .single();
    if (convErr || !newConv) {
      return { ok: false, error: "Could not start the conversation." };
    }
    conversationId = newConv.id;
  }

  // Thread: a small system note flagging the website enquiry + captured contact
  // line, then the visitor's actual message (so it drives the list preview).
  const contactLine = [d.name, emailLc, d.phone?.trim()]
    .filter(Boolean)
    .join(" · ");
  await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: null,
    is_system_message: true,
    system_event: "website_enquiry",
    body: `Website enquiry · ${contactLine}`,
    read_by_host: false,
    read_by_guest: true,
  });
  await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: guestId,
    body: d.message,
    read_by_host: false,
  });

  const siteName =
    ((site.brand as { name?: string } | null)?.name ?? "").trim() ||
    site.subdomain;

  // Notify the host (best-effort, dynamically imported so a dispatcher error
  // can't fail the enquiry that's already written).
  try {
    const { dispatchEvent } = await import("@/lib/notifications/dispatch");
    await dispatchEvent({
      kind: "website_enquiry_host",
      recipientUserId: hostRow.user_id,
      hostId: site.host_id,
      refs: {
        conversation_id: conversationId,
        guest_first_name: d.name.split(" ")[0] || d.name,
        site_name: siteName,
      },
    });
  } catch {
    // Notification is best-effort — the enquiry already succeeded.
  }

  // Optional: email the submission to the host's chosen address when the site's
  // enquiry-email setting is on (Settings tab). Best-effort, never blocks.
  const settings = (site.settings ?? {}) as {
    enquiry?: { emailEnabled?: boolean; emailTo?: string };
  };
  const emailTo = (settings.enquiry?.emailTo ?? "").trim();
  if (settings.enquiry?.emailEnabled && emailTo) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const inboxLink = appUrl
        ? `<p><a href="${appUrl}/dashboard/inbox?f=enquiries&c=${conversationId}" style="color:#0d9488;font-weight:600">Open in your inbox &rarr;</a></p>`
        : "";
      const { sendTransactionalEmail } = await import("@/lib/email/send");
      await sendTransactionalEmail({
        to: emailTo,
        subject: `New website enquiry — ${d.name}`,
        html: `<p>You've received a new enquiry from your website <strong>${esc(
          siteName,
        )}</strong>.</p><p><strong>Name:</strong> ${esc(d.name)}<br/><strong>Email:</strong> ${esc(
          emailLc,
        )}${d.phone?.trim() ? `<br/><strong>Phone:</strong> ${esc(d.phone.trim())}` : ""}</p><p><strong>Message:</strong><br/>${esc(
          d.message,
        ).replace(/\n/g, "<br/>")}</p>${inboxLink}`,
      });
    } catch {
      // Email is best-effort — the enquiry already succeeded.
    }
  }

  return { ok: true, data: { conversationId } };
}
