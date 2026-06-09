import type { Metadata } from "next";

import { createServerClient } from "@/lib/supabase/server";

import {
  GuestInboxList,
  type GuestConvRow,
} from "./_components/GuestInboxList";

export const metadata: Metadata = {
  title: "Messages",
};

export const dynamic = "force-dynamic";

export default async function PortalInboxPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("conversations")
    .select(
      `
      id,
      status,
      is_enquiry,
      unread_guest,
      last_message_preview,
      last_message_at,
      listing:listings ( name ),
      host:hosts ( display_name, avatar_url )
    `,
    )
    .eq("guest_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  type Row = {
    id: string;
    status: string;
    is_enquiry: boolean;
    unread_guest: number;
    last_message_preview: string | null;
    last_message_at: string | null;
    listing: { name: string } | { name: string }[] | null;
    host:
      | { display_name: string; avatar_url: string | null }
      | { display_name: string; avatar_url: string | null }[]
      | null;
  };
  const list = (rows as Row[] | null) ?? [];

  const conversations: GuestConvRow[] = list.map((c) => {
    const host = Array.isArray(c.host) ? c.host[0] : c.host;
    const listing = Array.isArray(c.listing) ? c.listing[0] : c.listing;
    return {
      id: c.id,
      status: c.status,
      isEnquiry: c.is_enquiry,
      unread: c.unread_guest ?? 0,
      preview: c.last_message_preview,
      lastAt: c.last_message_at,
      listingName: listing?.name ?? null,
      hostName: host?.display_name ?? "Host",
      hostAvatarUrl: host?.avatar_url ?? null,
    };
  });

  // Full-bleed surface (see @/lib/layout/fullBleed): the chat-list pane fills
  // the content area height and scrolls internally.
  return <GuestInboxList conversations={conversations} />;
}
