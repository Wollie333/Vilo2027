import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import type {
  ThreadBooking,
  ThreadQuote,
} from "@/components/inbox/ThreadQuoteCard";
import {
  BOOKING_CARD_COLUMNS,
  QUOTE_CARD_COLUMNS,
  mapBookingRow,
  mapQuoteRow,
} from "@/components/inbox/quote-thread";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { GuestThread, type GuestMessage } from "./GuestThread";

export const metadata: Metadata = {
  title: "Conversation",
};

export const dynamic = "force-dynamic";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function GuestThreadPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/inbox/${params.id}`);

  const { data: convRaw } = await supabase
    .from("conversations")
    .select(
      `
      id, guest_id, channel, host_last_seen_at,
      host:hosts ( display_name, avatar_url ),
      listing:properties ( name )
    `,
    )
    .eq("id", params.id)
    .eq("guest_id", user.id)
    .maybeSingle();
  if (!convRaw) notFound();

  const conv = convRaw as unknown as {
    id: string;
    guest_id: string;
    channel: string | null;
    host_last_seen_at: string | null;
    host:
      | { display_name: string; avatar_url: string | null }
      | { display_name: string; avatar_url: string | null }[]
      | null;
    listing: { name: string } | { name: string }[] | null;
  };
  const isPlatform = conv.channel === "platform";
  const host = one(conv.host);
  const listing = one(conv.listing);

  const { data: msgs } = await supabase
    .from("messages")
    .select(
      "id, sender_id, body, attachment_url, is_system_message, system_event, quote_id, quote_version_no, read_by_host, read_by_guest, created_at",
    )
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true });

  const messages: GuestMessage[] = (msgs ?? []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    body: m.body,
    attachmentUrl:
      (m as { attachment_url: string | null }).attachment_url ?? null,
    isSystem: m.is_system_message,
    systemEvent: (m as { system_event: string | null }).system_event ?? null,
    quoteId: (m as { quote_id: string | null }).quote_id ?? null,
    quoteVersionNo:
      (m as { quote_version_no: number | null }).quote_version_no ?? null,
    readByHost: (m as { read_by_host: boolean }).read_by_host,
    readByGuest: (m as { read_by_guest: boolean }).read_by_guest,
    createdAt: m.created_at,
  }));

  // Quotes referenced in the thread, rendered as inline cards. Guests can't
  // read `quotes` via RLS (guest access is token-gated), so we fetch with the
  // admin client — safe because we've already confirmed this conversation
  // belongs to the signed-in guest, and we scope the read to its id.
  const quotesById: Record<string, ThreadQuote> = {};
  const quoteIds = Array.from(
    new Set(messages.map((m) => m.quoteId).filter((id): id is string => !!id)),
  );
  if (quoteIds.length > 0) {
    const admin = createAdminClient();
    const { data: qRows } = await admin
      .from("quotes")
      .select(QUOTE_CARD_COLUMNS)
      .eq("conversation_id", params.id)
      .in("id", quoteIds);
    // Subject cover — the listing each quote is for (thumbnail + name).
    const propIds = Array.from(
      new Set(
        (qRows ?? [])
          .map((q) => q.property_id)
          .filter((id): id is string => !!id),
      ),
    );
    const subjectByQuote = new Map<
      string,
      { name: string | null; image: string | null; detail: string | null }
    >();
    if (propIds.length > 0) {
      const [{ data: props }, { data: coverPhotos }] = await Promise.all([
        admin.from("properties").select("id, name, city").in("id", propIds),
        admin
          .from("property_photos")
          .select("property_id, url, sort_order")
          .in("property_id", propIds)
          .is("room_id", null)
          .order("sort_order", { ascending: true }),
      ]);
      const nameById = new Map((props ?? []).map((p) => [p.id, p.name]));
      const cityById = new Map((props ?? []).map((p) => [p.id, p.city]));
      const coverById = new Map<string, string>();
      for (const ph of coverPhotos ?? [])
        if (!coverById.has(ph.property_id))
          coverById.set(ph.property_id, ph.url);
      for (const q of qRows ?? []) {
        if (!q.property_id) continue;
        subjectByQuote.set(q.id, {
          name: nameById.get(q.property_id) ?? null,
          image: coverById.get(q.property_id) ?? null,
          detail:
            q.scope === "rooms"
              ? "Specific room"
              : (cityById.get(q.property_id) ?? "Whole place"),
        });
      }
    }
    // The requester's own words = the first non-system message in the thread.
    const requestMessage =
      messages.find((m) => !m.isSystem && m.body)?.body ?? null;
    for (const q of qRows ?? []) {
      quotesById[q.id] = mapQuoteRow(
        q,
        undefined,
        subjectByQuote.get(q.id),
        requestMessage,
      );
    }
  }

  // Bookings the quotes became (once accepted) — drives the later card states.
  const bookingsById: Record<string, ThreadBooking> = {};
  const bookingIds = Object.values(quotesById)
    .map((q) => q.convertedBookingId)
    .filter((id): id is string => !!id);
  if (bookingIds.length > 0) {
    const admin = createAdminClient();
    const { data: bRows } = await admin
      .from("bookings")
      .select(BOOKING_CARD_COLUMNS)
      .in("id", bookingIds);
    for (const b of bRows ?? []) {
      bookingsById[b.id] = mapBookingRow(b);
    }
  }

  return (
    <GuestThread
      conversationId={conv.id}
      selfId={user.id}
      hostName={isPlatform ? "Wielo Support" : (host?.display_name ?? "Host")}
      hostAvatarUrl={isPlatform ? null : (host?.avatar_url ?? null)}
      hostLastSeenAt={conv.host_last_seen_at ?? null}
      listingName={isPlatform ? "Wielo team" : (listing?.name ?? null)}
      messages={messages}
      quotesById={quotesById}
      bookingsById={bookingsById}
    />
  );
}
