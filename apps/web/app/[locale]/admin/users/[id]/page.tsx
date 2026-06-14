import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import { fetchViloLedger } from "@/lib/billing/vilo-ledger";
import { fetchHostTransactions, txnStats } from "@/lib/finance/transactions";
import { createAdminClient } from "@/lib/supabase/admin";

import { UserRecord, type UserRecordData } from "./UserRecord";

export const dynamic = "force-dynamic";

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
      "id, full_name, email, role, phone, avatar_url, is_active, is_lead, phone_verified_at, id_verified_at, created_at, updated_at, deleted_at",
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
    { count: bookingsAsGuest },
    { count: refunds },
    { count: listings },
    subResult,
    viloRows,
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
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("host_id", host.id)
          .is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
    host
      ? service
          .from("subscriptions")
          .select(
            "plan, status, billing_cycle, trial_ends_at, current_period_end, cancel_at_period_end",
          )
          .eq("host_id", host.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchViloLedger(service, { userId: user.id, limit: 50 }),
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

  // Host booking-ledger KPIs (reuse the canonical engine; never fork).
  let hostFinance: UserRecordData["hostFinance"] = null;
  if (host) {
    try {
      const txns = await fetchHostTransactions(service, { hostId: host.id });
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
      deleted_at: user.deleted_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
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
      bookingsAsGuest: bookingsAsGuest ?? 0,
      listings: listings ?? 0,
      refunds: refunds ?? 0,
    },
    hostFinance,
    viloLedger: viloRows.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: t.amount,
      reason: t.reason,
      date: t.date,
    })),
    notes: (noteRows ?? []).map((n) => {
      const author = Array.isArray(n.author) ? n.author[0] : n.author;
      return {
        id: n.id,
        body: n.body,
        created_at: n.created_at,
        author: author?.full_name ?? null,
      };
    }),
    audit: (auditRows ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      created_at: a.created_at,
      impersonating: a.impersonating,
    })),
  };

  return <UserRecord data={data} />;
}
