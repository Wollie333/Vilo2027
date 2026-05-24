import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import {
  InboxView,
  type ConversationRow,
  type MessageRow,
  type TemplateRow,
  type ThreadContext,
} from "./InboxView";

export const metadata: Metadata = {
  title: "Inbox · Vilo",
};

export const dynamic = "force-dynamic";

type SearchParams = { c?: string; f?: string; q?: string };

const VALID_FOLDERS = [
  "all",
  "unread",
  "enquiries",
  "open",
  "archived",
] as const;
type Folder = (typeof VALID_FOLDERS)[number];

function parseFolder(raw: string | undefined): Folder {
  if (raw && (VALID_FOLDERS as readonly string[]).includes(raw)) {
    return raw as Folder;
  }
  return "all";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/inbox");

  const { data: host } = await supabase
    .from("hosts")
    .select("id, display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h1 className="font-display text-lg font-bold text-brand-ink">
            Set up your host profile first
          </h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Guest messages land in your inbox once you have a listing live.
          </p>
        </div>
      </div>
    );
  }

  const folder = parseFolder(searchParams?.f);
  const search = (searchParams?.q ?? "").trim();

  // Counts for chips/folders.
  const { data: countsRaw } = await supabase
    .from("conversations")
    .select("id, status, is_enquiry, unread_host")
    .eq("host_id", host.id);

  const all = countsRaw ?? [];
  const counts = {
    all: all.filter((c) => c.status !== "archived").length,
    unread: all
      .filter((c) => c.status !== "archived")
      .reduce((n, c) => n + (c.unread_host > 0 ? 1 : 0), 0),
    enquiries: all.filter((c) => c.is_enquiry && c.status === "open").length,
    open: all.filter((c) => c.status === "open").length,
    archived: all.filter((c) => c.status === "archived").length,
    unread_total: all.reduce((n, c) => n + (c.unread_host ?? 0), 0),
  };

  // Conversation list — filtered server-side.
  let query = supabase
    .from("conversations")
    .select(
      `
        id, status, is_enquiry, unread_host,
        last_message_at, last_message_preview, created_at,
        guest:user_profiles!conversations_guest_id_fkey ( id, full_name, email, avatar_url ),
        listing:listings ( id, name ),
        booking:bookings ( id, reference, status, check_in, check_out, nights, guests_count, total_amount, currency )
      `,
    )
    .eq("host_id", host.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (folder === "archived") {
    query = query.eq("status", "archived");
  } else {
    query = query.neq("status", "archived");
    if (folder === "open") query = query.eq("status", "open");
    if (folder === "enquiries") query = query.eq("is_enquiry", true);
    if (folder === "unread") query = query.gt("unread_host", 0);
  }

  const { data: convRows } = await query;

  type RawConvRow = {
    id: string;
    status: string;
    is_enquiry: boolean;
    unread_host: number;
    last_message_at: string | null;
    last_message_preview: string | null;
    created_at: string;
    guest: {
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    } | null;
    listing: { id: string; name: string } | null;
    booking: {
      id: string;
      reference: string;
      status: string;
      check_in: string | null;
      check_out: string | null;
      nights: number | null;
      guests_count: number | null;
      total_amount: string | number | null;
      currency: string;
    } | null;
  };

  const rawConversations = (convRows ?? []) as unknown as RawConvRow[];

  // Light search across what we've loaded.
  const needle = search.toLowerCase();
  const filtered = needle
    ? rawConversations.filter((c) => {
        const name = c.guest?.full_name?.toLowerCase() ?? "";
        const email = c.guest?.email?.toLowerCase() ?? "";
        const listing = c.listing?.name?.toLowerCase() ?? "";
        const ref = c.booking?.reference?.toLowerCase() ?? "";
        const preview = c.last_message_preview?.toLowerCase() ?? "";
        return (
          name.includes(needle) ||
          email.includes(needle) ||
          listing.includes(needle) ||
          ref.includes(needle) ||
          preview.includes(needle)
        );
      })
    : rawConversations;

  const conversations: ConversationRow[] = filtered.map((c) => ({
    id: c.id,
    status: c.status as "open" | "resolved" | "archived",
    isEnquiry: c.is_enquiry,
    unreadCount: c.unread_host ?? 0,
    lastMessageAt: c.last_message_at,
    lastMessagePreview: c.last_message_preview,
    createdAt: c.created_at,
    guestId: c.guest?.id ?? null,
    guestName: c.guest?.full_name ?? null,
    guestEmail: c.guest?.email ?? null,
    listingName: c.listing?.name ?? null,
    bookingReference: c.booking?.reference ?? null,
    bookingStatus: c.booking?.status ?? null,
    checkIn: c.booking?.check_in ?? null,
    checkOut: c.booking?.check_out ?? null,
  }));

  // Resolve selected conversation.
  const requested = searchParams?.c;
  const selectedId =
    (requested && conversations.find((c) => c.id === requested)?.id) ??
    conversations[0]?.id ??
    null;

  // Thread + context.
  let messages: MessageRow[] = [];
  let context: ThreadContext | null = null;

  if (selectedId) {
    const [{ data: msgs }, { data: ctxRaw }] = await Promise.all([
      supabase
        .from("messages")
        .select(
          "id, sender_id, body, attachment_url, attachment_type, attachment_filename, is_system_message, system_event, read_by_host, read_at, created_at",
        )
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true }),
      supabase
        .from("conversations")
        .select(
          `
            id, status, is_enquiry, created_at,
            guest:user_profiles!conversations_guest_id_fkey ( id, full_name, email, phone, avatar_url ),
            listing:listings ( id, name, slug ),
            booking:bookings ( id, reference, status, check_in, check_out, nights, guests_count, total_amount, currency )
          `,
        )
        .eq("id", selectedId)
        .maybeSingle(),
    ]);

    messages = (msgs ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      attachmentUrl: m.attachment_url,
      attachmentType: m.attachment_type as "image" | "pdf" | "other" | null,
      attachmentFilename: m.attachment_filename,
      isSystem: m.is_system_message,
      systemEvent: m.system_event,
      readByHost: m.read_by_host,
      createdAt: m.created_at,
    }));

    const ctx = ctxRaw as unknown as {
      id: string;
      status: string;
      is_enquiry: boolean;
      created_at: string;
      guest: {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        avatar_url: string | null;
      } | null;
      listing: { id: string; name: string; slug: string | null } | null;
      booking: {
        id: string;
        reference: string;
        status: string;
        check_in: string | null;
        check_out: string | null;
        nights: number | null;
        guests_count: number | null;
        total_amount: string | number | null;
        currency: string;
      } | null;
    } | null;

    if (ctx) {
      context = {
        conversationId: ctx.id,
        status: ctx.status as "open" | "resolved" | "archived",
        isEnquiry: ctx.is_enquiry,
        createdAt: ctx.created_at,
        guest: ctx.guest
          ? {
              id: ctx.guest.id,
              fullName: ctx.guest.full_name,
              email: ctx.guest.email,
              phone: ctx.guest.phone,
              avatarUrl: ctx.guest.avatar_url,
            }
          : null,
        listing: ctx.listing
          ? {
              id: ctx.listing.id,
              name: ctx.listing.name,
              slug: ctx.listing.slug,
            }
          : null,
        booking: ctx.booking
          ? {
              id: ctx.booking.id,
              reference: ctx.booking.reference,
              status: ctx.booking.status,
              checkIn: ctx.booking.check_in,
              checkOut: ctx.booking.check_out,
              nights: ctx.booking.nights,
              guests: ctx.booking.guests_count,
              total:
                ctx.booking.total_amount == null
                  ? null
                  : Number(ctx.booking.total_amount),
              currency: ctx.booking.currency,
            }
          : null,
      };
    }
  }

  // Quick-reply templates.
  const { data: tmplRaw } = await supabase
    .from("message_templates")
    .select("id, title, body, sort_order")
    .eq("host_id", host.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const templates: TemplateRow[] = (tmplRaw ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body,
  }));

  const hostInitials =
    (host.display_name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase() ?? "")
      .join("") || "ME";

  return (
    <InboxView
      hostInitials={hostInitials}
      hostName={host.display_name}
      folder={folder}
      counts={counts}
      search={search}
      conversations={conversations}
      selectedId={selectedId}
      messages={messages}
      context={context}
      templates={templates}
    />
  );
}
