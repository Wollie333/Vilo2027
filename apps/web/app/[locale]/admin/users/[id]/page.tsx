import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import {
  getActiveSupportGrant,
  getLatestSupportGrant,
} from "@/lib/admin/supportGrant";
import { getAffiliateBalance } from "@/lib/affiliate/balance";
import { fetchWieloLedger } from "@/lib/billing/wielo-ledger";
import { fetchHostTransactions, txnStats } from "@/lib/finance/transactions";
import { getAllPlans } from "@/lib/plans/getPlans";
import { getSubscriptionProducts } from "@/lib/products/getProducts";
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
    wieloRows,
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
            "plan, status, billing_cycle, trial_ends_at, current_period_end, cancel_at_period_end, product_id",
          )
          .eq("host_id", host.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchWieloLedger(service, { userId: user.id, limit: 100 }),
    service
      .from("bookings")
      .select(
        "id, reference, status, check_in, check_out, total_amount, currency, created_at, listing:properties ( name )",
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
      .select(
        "id, action, target_type, created_at, impersonating, actor:user_profiles!admin_id ( full_name )",
      )
      // Surface entries that target this user directly, impersonate them, or
      // act on something they own (e.g. an admin editing their listing, tagged
      // with payload.owner_user_id) — so the Activity tab is a full who/what/
      // when trail including staff changes.
      .or(
        `target_id.eq.${user.id},impersonating.eq.${user.id},payload->>owner_user_id.eq.${user.id}`,
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Host-only datasets.
  let listings: UserRecordData["listings"] = [];
  let businesses: UserRecordData["businesses"] = [];
  let bookingsAsHost: UserRecordData["bookingsAsHost"] = [];
  let reviewsReceived: UserRecordData["reviewsReceived"] = [];
  let guestRatingsGiven: UserRecordData["guestRatingsGiven"] = [];
  let addons: UserRecordData["addons"] = [];
  let policies: UserRecordData["policies"] = [];
  let hostFinance: UserRecordData["hostFinance"] = null;
  let hostTxns: UserRecordData["hostTxns"] = [];
  let listingsCount = 0;

  if (host) {
    const [
      { data: lrows, count: lcount },
      { data: brows },
      { data: bookHost },
      { data: revRecv },
      { data: grGiven },
    ] = await Promise.all([
      service
        .from("properties")
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
        .select(
          "id, trading_name, legal_name, vat_number, company_registration_number, address_line1, address_line2, city, municipality, province, postal_code, country, latitude, longitude, default_currency, default_language, is_default, is_archived",
        )
        .eq("host_id", host.id)
        .order("is_default", { ascending: false }),
      service
        .from("bookings")
        .select(
          "id, reference, status, check_in, check_out, total_amount, currency, created_at, listing:properties ( name ), guest:user_profiles!bookings_guest_id_fkey ( full_name )",
        )
        .eq("host_id", host.id)
        .order("created_at", { ascending: false })
        .limit(50),
      service
        .from("reviews")
        .select(
          "id, rating, body, created_at, is_published, host_response, listing:properties!reviews_listing_id_fkey ( name ), guest:user_profiles!reviews_guest_id_fkey ( full_name )",
        )
        .eq("host_id", host.id)
        .order("created_at", { ascending: false })
        .limit(50),
      // Host → guest ratings this host has left (private; the Reviews tab shows
      // them as the "reviews of guests" table).
      service
        .from("guest_ratings")
        .select(
          "id, rating, summary, updated_at, guest:user_profiles ( full_name, email )",
        )
        .eq("host_id", host.id)
        .order("updated_at", { ascending: false })
        .limit(100),
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
      tradingName: b.trading_name ?? "",
      legalName: b.legal_name ?? "",
      vatNumber: b.vat_number ?? "",
      companyRegistrationNumber: b.company_registration_number ?? "",
      addressLine1: b.address_line1 ?? "",
      addressLine2: b.address_line2 ?? "",
      city: b.city ?? "",
      municipality: b.municipality ?? "",
      province: b.province ?? "",
      postalCode: b.postal_code ?? "",
      country: b.country ?? "ZA",
      defaultCurrency: b.default_currency ?? "ZAR",
      defaultLanguage: b.default_language ?? "en",
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
    guestRatingsGiven = (grGiven ?? []).map((g) => ({
      id: g.id,
      rating: g.rating,
      summary: g.summary,
      date: g.updated_at,
      guestName: one(g.guest)?.full_name ?? "Guest",
      guestEmail: one(g.guest)?.email ?? null,
    }));

    // Host-wide add-ons catalog + policies library (managed from the admin
    // "Add-ons & policies" tab). Counts how many listings each is attached to.
    const [{ data: addonRows }, { data: policyRows }] = await Promise.all([
      service
        .from("addons")
        .select(
          "id, name, description, pricing_model, unit_price, currency, category, is_active, is_required, min_quantity, max_quantity, stock_quantity, allow_custom_quantity, lead_time_days, vat_included, sort_order",
        )
        .eq("host_id", host.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      service
        .from("policies")
        .select(
          "id, name, type, status, preset, is_default, is_non_refundable, summary, updated_at",
        )
        .eq("host_id", host.id)
        .is("deleted_at", null)
        .neq("status", "archived")
        .order("type", { ascending: true })
        .order("updated_at", { ascending: false }),
    ]);

    const addonIds = (addonRows ?? []).map((a) => a.id);
    const policyIds = (policyRows ?? []).map((p) => p.id);
    const [{ data: laRows }, { data: lpRows }] = await Promise.all([
      addonIds.length
        ? service
            .from("property_addons")
            .select("addon_id")
            .in("addon_id", addonIds)
        : Promise.resolve({ data: [] as { addon_id: string }[] }),
      policyIds.length
        ? service
            .from("property_policies")
            .select("policy_id")
            .in("policy_id", policyIds)
        : Promise.resolve({ data: [] as { policy_id: string }[] }),
    ]);
    const addonAttach = new Map<string, number>();
    for (const r of laRows ?? [])
      addonAttach.set(r.addon_id, (addonAttach.get(r.addon_id) ?? 0) + 1);
    const policyAttach = new Map<string, number>();
    for (const r of lpRows ?? [])
      policyAttach.set(r.policy_id, (policyAttach.get(r.policy_id) ?? 0) + 1);

    addons = (addonRows ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      pricingModel: a.pricing_model,
      unitPrice: Number(a.unit_price ?? 0),
      currency: a.currency ?? "ZAR",
      category: a.category,
      isActive: a.is_active ?? true,
      isRequired: a.is_required ?? false,
      minQuantity: a.min_quantity ?? 1,
      maxQuantity: a.max_quantity,
      stockQuantity: a.stock_quantity,
      allowCustomQuantity: a.allow_custom_quantity ?? true,
      leadTimeDays: a.lead_time_days ?? 0,
      vatIncluded: a.vat_included ?? false,
      listingsCount: addonAttach.get(a.id) ?? 0,
    }));
    policies = (policyRows ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      preset: p.preset,
      isDefault: p.is_default ?? false,
      isNonRefundable: p.is_non_refundable ?? false,
      summary: p.summary,
      updatedAt: p.updated_at,
      assignmentsCount: policyAttach.get(p.id) ?? 0,
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
      "id, rating, body, created_at, is_published, host_response, listing:properties!reviews_listing_id_fkey ( name ), host:hosts ( display_name )",
    )
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Host-consent support grant (gates admin editing) + the full request/decision
  // history for the transparent activity log.
  let support: UserRecordData["support"] = null;
  let supportGrants: UserRecordData["supportGrants"] = [];
  if (host) {
    const { data: grantRows } = await service
      .from("admin_support_grants")
      .select(
        "id, status, reason, requested_at, decided_at, expires_at, requester:user_profiles!requested_by ( full_name )",
      )
      .eq("host_id", host.id)
      .order("requested_at", { ascending: false })
      .limit(30);
    supportGrants = (grantRows ?? []).map((g) => ({
      id: g.id,
      status: g.status,
      reason: g.reason,
      requestedAt: g.requested_at,
      decidedAt: g.decided_at,
      expiresAt: g.expires_at,
      requestedBy: one(g.requester)?.full_name ?? null,
    }));

    const active = await getActiveSupportGrant(service, host.id);
    if (active) {
      support = {
        active: true,
        status: "approved",
        expiresAt: active.expiresAt,
      };
    } else {
      const latest = await getLatestSupportGrant(service, host.id);
      support = {
        active: false,
        status: latest?.status ?? "none",
        expiresAt: latest?.expiresAt ?? null,
      };
    }
  }

  const sub = (subResult as { data: UserRecordData["subscription"] }).data;

  // Catalog products for the Products tab (manage the user's subscription).
  const catalog = host ? await getSubscriptionProducts() : [];

  // Referrals this user has made as an affiliate (their affiliate link's signups).
  const referralBundle = await loadReferrals(service, user.id);

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
    addons,
    policies,
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
    guestRatingsGiven,
    hostFinance,
    hostTxns,
    support,
    supportGrants,
    planOptions: (await getAllPlans()).map((p) => ({
      key: p.key,
      name: p.name,
    })),
    products: catalog.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      billingCycle: p.billingCycle,
      trialDays: p.trialDays,
      slug: p.slug,
      isFree: p.isFree,
      isRecommended: p.isRecommended,
      bullets: p.bullets,
    })),
    wieloLedger: wieloRows.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: t.amount,
      reason: t.reason,
      date: t.date,
    })),
    relationships: relationshipBundle,
    affiliateSlug: referralBundle.slug,
    affiliateStats: referralBundle.stats,
    referrals: referralBundle.referrals,
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
      targetType: a.target_type ?? null,
      actor: one(a.actor)?.full_name ?? null,
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
    .select("id, related_contact_id, source_booking_id, created_at")
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false })
    .limit(50);
  const relatedIds = [
    ...new Set((rels ?? []).map((r) => r.related_contact_id)),
  ];
  if (relatedIds.length === 0) return [];

  const { data: related } = await service
    .from("host_contacts")
    .select("id, name, email, phone, guest_id")
    .in("id", relatedIds);
  const byId = new Map((related ?? []).map((c) => [c.id, c]));

  // Resolve avatars (and a phone fallback) from the linked account, by guest_id
  // and by email — host_contacts has no avatar of its own.
  const accountIds = [
    ...new Set((related ?? []).map((c) => c.guest_id).filter(Boolean)),
  ] as string[];
  const emails = [
    ...new Set(
      (related ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean),
    ),
  ] as string[];
  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, email, phone, avatar_url")
    .or(
      [
        accountIds.length ? `id.in.(${accountIds.join(",")})` : null,
        emails.length
          ? `email.in.(${emails.map((e) => `"${e}"`).join(",")})`
          : null,
      ]
        .filter(Boolean)
        .join(",") || "id.eq.00000000-0000-0000-0000-000000000000",
    );
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const profileByEmail = new Map(
    (profiles ?? []).map((p) => [(p.email ?? "").toLowerCase(), p]),
  );

  const seen = new Set<string>();
  const out: UserRecordData["relationships"] = [];
  for (const r of rels ?? []) {
    const c = byId.get(r.related_contact_id);
    if (!c) continue;
    const key = (c.email ?? c.name ?? c.id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const profile =
      (c.guest_id ? profileById.get(c.guest_id) : null) ??
      (c.email ? profileByEmail.get(c.email.toLowerCase()) : null) ??
      null;
    out.push({
      id: r.id,
      contactId: c.id,
      name: c.name ?? "Guest",
      email: c.email,
      phone: c.phone ?? profile?.phone ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      connectedAt: r.created_at ?? null,
    });
  }
  return out;
}

const PAID_PLANS = new Set(["basic", "pro", "business"]);

// Everyone this user has referred via their affiliate link, with each referred
// user's plan and the commission earned from them.
async function loadReferrals(
  service: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{
  slug: string | null;
  stats: UserRecordData["affiliateStats"];
  referrals: UserRecordData["referrals"];
}> {
  const { data: account } = await service
    .from("affiliate_accounts")
    .select("id, slug, currency, status, default_payout_method")
    .eq("user_id", userId)
    .maybeSingle();
  if (!account) return { slug: null, stats: null, referrals: [] };

  const [{ data: refs }, { count: clicks }, balance] = await Promise.all([
    service
      .from("affiliate_referrals")
      .select("id, referred_user_id, bound_at")
      .eq("affiliate_id", account.id)
      .order("bound_at", { ascending: false }),
    service
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", account.id),
    getAffiliateBalance(service, account.id).catch(() => null),
  ]);

  const stats: UserRecordData["affiliateStats"] = {
    accountId: account.id,
    currency: account.currency,
    status: account.status ?? "active",
    defaultMethod: account.default_payout_method ?? null,
    clicks: clicks ?? 0,
    signups: refs?.length ?? 0,
    pending: balance?.pending ?? 0,
    earned: balance?.lifetime ?? 0,
    available: balance?.available ?? 0,
    paid: balance?.paid ?? 0,
  };

  if (!refs || refs.length === 0) {
    return { slug: account.slug, stats, referrals: [] };
  }

  const referredIds = refs.map((r) => r.referred_user_id);
  const [{ data: profiles }, { data: hosts }, { data: commissions }] =
    await Promise.all([
      service
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", referredIds),
      service.from("hosts").select("id, user_id").in("user_id", referredIds),
      service
        .from("affiliate_commissions")
        .select("referral_id, commission_amount, status")
        .eq("affiliate_id", account.id),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const hostByUser = new Map((hosts ?? []).map((h) => [h.user_id, h.id]));
  const hostIds = (hosts ?? []).map((h) => h.id);
  const { data: subs } = hostIds.length
    ? await service
        .from("subscriptions")
        .select("host_id, plan, status, product_id")
        .in("host_id", hostIds)
    : {
        data: [] as {
          host_id: string;
          plan: string | null;
          status: string;
          product_id: string | null;
        }[],
      };
  const subByHost = new Map((subs ?? []).map((s) => [s.host_id, s]));

  // Resolve the actual product name each referred host's subscription points to.
  const productIds = [
    ...new Set((subs ?? []).map((s) => s.product_id).filter(Boolean)),
  ] as string[];
  const { data: products } = productIds.length
    ? await service.from("products").select("id, name").in("id", productIds)
    : { data: [] as { id: string; name: string }[] };
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  const commByReferral = new Map<string, number>();
  for (const c of commissions ?? []) {
    if (c.status === "voided") continue;
    commByReferral.set(
      c.referral_id,
      (commByReferral.get(c.referral_id) ?? 0) + Number(c.commission_amount),
    );
  }

  const referrals = refs.map((r) => {
    const profile = profileById.get(r.referred_user_id);
    const hostId = hostByUser.get(r.referred_user_id);
    const sub = hostId ? subByHost.get(hostId) : undefined;
    const isPaid =
      !!sub &&
      sub.plan != null &&
      PAID_PLANS.has(sub.plan) &&
      ["active", "trialing", "past_due"].includes(sub.status);
    const plan = isPaid
      ? sub!.plan!.charAt(0).toUpperCase() + sub!.plan!.slice(1)
      : hostId
        ? "Free"
        : "Guest";
    const productName =
      (sub?.product_id ? productNameById.get(sub.product_id) : null) ||
      (hostId ? `${plan} plan` : "No subscription");
    return {
      id: r.id,
      userId: r.referred_user_id,
      name: profile?.full_name || "Unnamed",
      email: profile?.email ?? null,
      plan,
      productName,
      commission: Number(commByReferral.get(r.id) ?? 0),
      currency: account.currency,
      joinedAt: r.bound_at,
    };
  });

  return { slug: account.slug, stats, referrals };
}
