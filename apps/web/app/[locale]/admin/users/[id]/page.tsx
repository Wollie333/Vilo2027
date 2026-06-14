import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import { fetchViloLedger } from "@/lib/billing/vilo-ledger";
import { fetchHostTransactions, txnStats } from "@/lib/finance/transactions";
import { createAdminClient } from "@/lib/supabase/admin";

import { UserRecord, type UserRecordData } from "./UserRecord";

export const dynamic = "force-dynamic";

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("users.view");
  const service = createAdminClient();

  const { data: user } = await service
    .from("user_profiles")
    .select(
      "id, full_name, email, role, phone, avatar_url, is_active, is_lead, phone_verified_at, id_verified_at, country, created_at, updated_at, deleted_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!user) notFound();

  const { data: host } = await service
    .from("hosts")
    .select(
      "id, handle, display_name, is_verified, total_bookings, avg_rating, total_reviews",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const [
    { count: bookingsAsGuestCount },
    { count: refundsCount },
    subResult,
    viloRows,
    bookingsAsGuestRes,
    relationshipBundle,
    { data: dataReqRows },
    { data: noteRows },
    { data: auditRows },
  ] = await Promise.all([
    service
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id),
    service
      .from("refund_requests")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id),
    host
      ? service
          .from("subscriptions")
          .select(
            "plan, status, billing_cycle, trial_ends_at, current_period_end, cancel_at_period_end",
          )
          .eq("host_id", host.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchViloLedger(service, { userId: user.id, limit: 100 }),
    service
      .from("bookings")
      .select(
        "id, reference, status, check_in, check_out, total_amount, currency, created_at, listing:listings ( name )",
      )
      .eq("guest_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    loadRelationships(service, user.email),
    service
      .from("data_requests")
      .select("id, request_type, status, created_at, fulfilled_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    service
      .from("admin_user_notes")
      .select(
        "id, body, created_at, author:user_profiles!author_id ( full_name )",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    service
      .from("admin_audit_log")
      .select("id, action, created_at, impersonating")
      .or(`target_id.eq.${user.id},impersonating.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Host-only datasets.
  let listings: UserRecordData["listings"] = [];
  let businesses: UserRecordData["businesses"] = [];
  let bookingsAsHost: UserRecordData["bookingsAsHost"] = [];
  let reviewsReceived: UserRecordData["reviewsReceived"] = [];
  let hostFinance: UserRecordData["hostFinance"] = null;
  let hostTxns: UserRecordData["hostTxns"] = [];
  let listingsCount = 0;

  if (host) {
    const [
      { data: lrows, count: lcount },
      { data: brows },
      { data: bookHost },
      { data: revRecv },
    ] = await Promise.all([
      service
        .from("listings")
        .select(
          "id, name, city, province, is_published, base_price, currency, slug",
          {
            count: "exact",
          },
        )
        .eq("host_id", host.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      service
        .from("businesses")
        .select("id, trading_name, legal_name, is_default, is_archived")
        .eq("host_id", host.id)
        .order("is_default", { ascending: false }),
      service
        .from("bookings")
        .select(
          "id, reference, status, check_in, check_out, total_amount, currency, created_at, listing:listings ( name ), guest:user_profiles!bookings_guest_id_fkey ( full_name )",
        )
        .eq("host_id", host.id)
        .order("created_at", { ascending: false })
        .limit(50),
      service
        .from("reviews")
        .select(
          "id, rating, body, created_at, is_published, host_response, listing:listings ( name ), guest:user_profiles!reviews_guest_id_fkey ( full_name )",
        )
        .eq("host_id", host.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    listingsCount = lcount ?? 0;
    listings = (lrows ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      location: [l.city, l.province].filter(Boolean).join(", "),
      isPublished: l.is_published ?? false,
      price: Number(l.base_price ?? 0),
      currency: l.currency ?? "ZAR",
      slug: l.slug,
    }));
    businesses = (brows ?? []).map((b) => ({
      id: b.id,
      name: b.trading_name || b.legal_name || "Business",
      isDefault: b.is_default ?? false,
      isArchived: b.is_archived ?? false,
    }));
    bookingsAsHost = (bookHost ?? []).map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      checkIn: b.check_in,
      checkOut: b.check_out,
      total: Number(b.total_amount ?? 0),
      currency: b.currency ?? "ZAR",
      listingName: one(b.listing)?.name ?? "—",
      counterparty: one(b.guest)?.full_name ?? "Guest",
    }));
    reviewsReceived = (revRecv ?? []).map((rv) => ({
      id: rv.id,
      rating: rv.rating,
      body: rv.body,
      createdAt: rv.created_at,
      isPublished: rv.is_published ?? false,
      hostResponse: rv.host_response,
      listingName: one(rv.listing)?.name ?? "—",
      counterparty: one(rv.guest)?.full_name ?? "Guest",
    }));

    try {
      const txns = await fetchHostTransactions(service, { hostId: host.id });
      hostTxns = txns;
      const s = txnStats(txns);
      hostFinance = {
        collected: s.collected,
        outstanding: s.outstanding,
        refunded: s.refunded,
        net: s.net,
      };
    } catch {
      hostFinance = null;
    }
  }

  // Reviews this user WROTE (as a guest).
  const { data: revWritten } = await service
    .from("reviews")
    .select(
      "id, rating, body, created_at, is_published, host_response, listing:listings ( name ), host:hosts ( display_name )",
    )
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const sub = (subResult as { data: UserRecordData["subscription"] }).data;

  const data: UserRecordData = {
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active ?? true,
      is_lead: user.is_lead,
      country: user.country,
      deleted_at: user.deleted_at,
      created_at: user.created_at,
      phone_verified_at: user.phone_verified_at,
      id_verified_at: user.id_verified_at,
      avatar_url: user.avatar_url,
    },
    host: host
      ? {
          id: host.id,
          handle: host.handle,
          display_name: host.display_name,
          is_verified: host.is_verified ?? false,
          total_bookings: host.total_bookings,
          avg_rating: host.avg_rating,
          total_reviews: host.total_reviews,
        }
      : null,
    subscription: sub,
    counts: {
      bookingsAsGuest: bookingsAsGuestCount ?? 0,
      refunds: refundsCount ?? 0,
      listings: listingsCount,
    },
    listings,
    businesses,
    bookingsAsGuest: (bookingsAsGuestRes.data ?? []).map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      checkIn: b.check_in,
      checkOut: b.check_out,
      total: Number(b.total_amount ?? 0),
      currency: b.currency ?? "ZAR",
      listingName: one(b.listing)?.name ?? "—",
      counterparty: null,
    })),
    bookingsAsHost,
    reviewsWritten: (revWritten ?? []).map((rv) => ({
      id: rv.id,
      rating: rv.rating,
      body: rv.body,
      createdAt: rv.created_at,
      isPublished: rv.is_published ?? false,
      hostResponse: rv.host_response,
      listingName: one(rv.listing)?.name ?? "—",
      counterparty: one(rv.host)?.display_name ?? "Host",
    })),
    reviewsReceived,
    hostFinance,
    hostTxns,
    viloLedger: viloRows.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: t.amount,
      reason: t.reason,
      date: t.date,
    })),
    relationships: relationshipBundle,
    dataRequests: (dataReqRows ?? []).map((d) => ({
      id: d.id,
      type: d.request_type,
      status: d.status,
      createdAt: d.created_at,
      fulfilledAt: d.fulfilled_at,
    })),
    notes: (noteRows ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      created_at: n.created_at,
      author: one(n.author)?.full_name ?? null,
    })),
    audit: (auditRows ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      created_at: a.created_at,
      impersonating: a.impersonating,
    })),
  };

  return <UserRecord data={data} />;
}

// Relationships are stored per-host via host_contacts. Resolve the user's
// contact rows (by email, across hosts), then their travelled-with links.
async function loadRelationships(
  service: ReturnType<typeof createAdminClient>,
  email: string | null,
): Promise<UserRecordData["relationships"]> {
  if (!email) return [];
  const { data: contacts } = await service
    .from("host_contacts")
    .select("id")
    .ilike("email", email);
  const contactIds = (contacts ?? []).map((c) => c.id);
  if (contactIds.length === 0) return [];

  const { data: rels } = await service
    .from("guest_relationships")
    .select("id, related_contact_id, source_booking_id")
    .in("contact_id", contactIds)
    .limit(50);
  const relatedIds = [
    ...new Set((rels ?? []).map((r) => r.related_contact_id)),
  ];
  if (relatedIds.length === 0) return [];

  const { data: related } = await service
    .from("host_contacts")
    .select("id, name, email")
    .in("id", relatedIds);
  const byId = new Map((related ?? []).map((c) => [c.id, c]));

  const seen = new Set<string>();
  const out: UserRecordData["relationships"] = [];
  for (const r of rels ?? []) {
    const c = byId.get(r.related_contact_id);
    if (!c) continue;
    const key = (c.email ?? c.name ?? c.id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: r.id, name: c.name ?? "Guest", email: c.email });
  }
  return out;
}
