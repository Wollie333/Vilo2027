import { ensureWieloGuestThread } from "@/lib/inbox/platform-thread";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { GuestInboxShell } from "./_components/GuestInboxShell";
import { type GuestConvRow } from "./_components/GuestInboxList";

export const dynamic = "force-dynamic";

// Inbox layout: renders the persistent conversation list (left) around the
// active thread (right), so the guest inbox is one two-pane chat screen.
export default async function PortalInboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <>{children}</>;

  // Ensure this guest's always-present, pinned "Wielo Support" thread exists (and
  // is seeded) so they always have a direct line to the Wielo team. Uses the
  // service role (creating the thread/message needs it); failure here must never
  // block the inbox from loading.
  try {
    await ensureWieloGuestThread(createAdminClient(), user.id);
  } catch {
    /* non-fatal — the rest of the inbox still renders */
  }

  const { data: rows } = await supabase
    .from("conversations")
    .select(
      `
      id, status, is_enquiry, channel, pinned, unread_guest,
      last_message_preview, last_message_at,
      listing:properties ( name ),
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
    channel: string | null;
    pinned: boolean | null;
    unread_guest: number;
    last_message_preview: string | null;
    last_message_at: string | null;
    listing: { name: string } | { name: string }[] | null;
    host:
      | { display_name: string; avatar_url: string | null }
      | { display_name: string; avatar_url: string | null }[]
      | null;
  };

  const conversations: GuestConvRow[] = ((rows as Row[] | null) ?? []).map(
    (c) => {
      const host = Array.isArray(c.host) ? c.host[0] : c.host;
      const listing = Array.isArray(c.listing) ? c.listing[0] : c.listing;
      const isPlatform = c.channel === "platform";
      return {
        id: c.id,
        status: c.status,
        isEnquiry: c.is_enquiry,
        isPlatform,
        unread: c.unread_guest ?? 0,
        preview: c.last_message_preview,
        lastAt: c.last_message_at,
        listingName: isPlatform ? null : (listing?.name ?? null),
        hostName: isPlatform ? "Wielo Support" : (host?.display_name ?? "Host"),
        hostAvatarUrl: isPlatform ? null : (host?.avatar_url ?? null),
      };
    },
  );

  // The Wielo Support thread is ALWAYS the first thread — sticky above the rest.
  // Array.sort is stable, so everything else keeps its newest-first order.
  conversations.sort((a, b) => Number(b.isPlatform) - Number(a.isPlatform));

  return (
    <GuestInboxShell conversations={conversations}>{children}</GuestInboxShell>
  );
}
