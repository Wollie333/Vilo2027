import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ShieldCheck } from "lucide-react";

import { getMyHostId } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { PolicyLibrary, type PolicyCard } from "./PolicyLibrary";
import { isLockedPreset, type CheckInMethod, type PolicyType } from "./schemas";

export const metadata: Metadata = {
  title: "Policies",
};

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/policies");

  const hostId = await getMyHostId(supabase);

  if (!hostId) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-bold text-brand-ink">
          Create your host profile first
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          Finish host onboarding before setting up policies.
        </p>
      </div>
    );
  }

  // Materialise the locked refund presets for this host (idempotent). Seed one
  // editable default Terms & Conditions doc too (privacy stays platform-wide).
  // Seeder RPCs are service_role-only (they bypass RLS to write for a host);
  // hostId is the caller's own host, so running them via admin is safe.
  const seed = createAdminClient();
  await seed.rpc("ensure_host_policy_presets", { p_host_id: hostId });
  await seed.rpc("ensure_host_booking_terms", { p_host_id: hostId });
  // Guarantee a default per type exists (cancellation prefers the Moderate
  // preset) so every listing without an explicit assignment still resolves a
  // policy — and refunds are enforceable. Idempotent.
  await seed.rpc("ensure_host_default_policies", { p_host_id: hostId });

  const { data: policies } = await supabase
    .from("policies")
    .select(
      "id, type, name, summary, preset, status, is_default, is_non_refundable, check_in_time, check_out_time, check_in_method, pets_allowed, smoking_allowed, parties_allowed, children_welcome, quiet_hours_start, quiet_hours_end, version, updated_at",
    )
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .in("status", ["active", "draft"])
    .in("type", [
      "cancellation",
      "check_in_out",
      "house_rules",
      "booking_terms",
    ])
    .order("type", { ascending: true })
    .order("created_at", { ascending: true });

  const ids = (policies ?? []).map((p) => p.id);

  // Children + assignment coverage in parallel.
  const [{ data: rules }, { data: content }, { data: listings }] =
    await Promise.all([
      ids.length
        ? supabase
            .from("policy_cancellation_rules")
            .select("policy_id, days_before, refund_percent, label, sort_order")
            .in("policy_id", ids)
            .order("days_before", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
      ids.length
        ? supabase
            .from("policy_content")
            .select("policy_id, body_html")
            .in("policy_id", ids)
            .eq("locale", "en")
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("properties")
        .select("id, name")
        .eq("host_id", hostId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);

  const listingIds = (listings ?? []).map((l) => l.id);

  const [{ data: rooms }, { data: assignments }] = await Promise.all([
    listingIds.length
      ? supabase
          .from("property_rooms")
          .select("id, property_id, name")
          .in("property_id", listingIds)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
      : Promise.resolve({
          data: [] as { id: string; property_id: string; name: string }[],
        }),
    listingIds.length
      ? supabase
          .from("property_policies")
          .select("property_id, room_id, policy_id, policy_type")
          .in("property_id", listingIds)
      : Promise.resolve({
          data: [] as {
            property_id: string;
            room_id: string | null;
            policy_id: string;
            policy_type: string;
          }[],
        }),
  ]);

  // ── Rule + content maps ──
  const rulesByPolicy = new Map<
    string,
    { days_before: number; refund_percent: number; label: string }[]
  >();
  (rules ?? []).forEach((r) => {
    const arr = rulesByPolicy.get(r.policy_id) ?? [];
    arr.push({
      days_before: r.days_before,
      refund_percent: r.refund_percent,
      label: r.label,
    });
    rulesByPolicy.set(r.policy_id, arr);
  });

  const bodyByPolicy = new Map<string, string>();
  (content ?? []).forEach((c) => {
    if (c.body_html) bodyByPolicy.set(c.policy_id, c.body_html);
  });

  // ── Per-policy assignment count (room-level + listing-wide rows) ──
  const assignCount = new Map<string, number>();
  (assignments ?? []).forEach((a) => {
    assignCount.set(a.policy_id, (assignCount.get(a.policy_id) ?? 0) + 1);
  });

  // ── Coverage: a room is covered for a type if it has a room-level
  //    assignment OR its listing has a listing-wide one. ──
  const allRooms = rooms ?? [];
  const wideByListing = new Map<string, Set<string>>(); // listingId -> types
  const roomScoped = new Set<string>(); // `${roomId}:${type}`
  (assignments ?? []).forEach((a) => {
    if (a.room_id === null) {
      const set = wideByListing.get(a.property_id) ?? new Set<string>();
      set.add(a.policy_type);
      wideByListing.set(a.property_id, set);
    } else {
      roomScoped.add(`${a.room_id}:${a.policy_type}`);
    }
  });
  const roomCovered = (roomId: string, listingId: string, type: string) =>
    roomScoped.has(`${roomId}:${type}`) ||
    (wideByListing.get(listingId)?.has(type) ?? false);

  const roomsTotal = allRooms.length;
  const roomsWithCancellation = allRooms.filter((r) =>
    roomCovered(r.id, r.property_id, "cancellation"),
  ).length;
  const roomsWithHouseRules = allRooms.filter((r) =>
    roomCovered(r.id, r.property_id, "house_rules"),
  ).length;
  const fullyCovered =
    roomsTotal > 0 &&
    roomsWithCancellation === roomsTotal &&
    roomsWithHouseRules === roomsTotal;

  // ── Smart coverage gaps (drives the warning banner + inline assign modal) ──
  // For cancellation + house rules, per listing:
  //  • listing-wide assignment exists  → every room covered, no gap.
  //  • a room has no assignment (and none listing-wide) → that ROOM is a gap.
  //  • every room individually covered but NO listing-wide → the PROPERTY
  //    (whole-listing) is a gap — booking the whole place has no policy.
  // Host defaults are deliberately NOT counted as coverage: the warning nudges
  // explicit assignment. Each gap is fixed inline from a modal (no redirect).
  const listingNameById = new Map(
    (listings ?? []).map((l) => [
      l.id as string,
      (l.name as string) || "Untitled listing",
    ]),
  );
  const WARN_TYPES: PolicyType[] = ["cancellation", "house_rules"];
  type Gap = {
    key: string;
    scope: "room" | "listing";
    listingId: string;
    listingName: string;
    roomId: string | null;
    targetName: string;
    missing: PolicyType[];
  };
  const gapMap = new Map<string, Gap>();
  const addGap = (
    scope: "room" | "listing",
    listingId: string,
    roomId: string | null,
    targetName: string,
    type: PolicyType,
  ) => {
    const key = `${listingId}:${roomId ?? "_"}`;
    const g =
      gapMap.get(key) ??
      ({
        key,
        scope,
        listingId,
        listingName: listingNameById.get(listingId) ?? "Listing",
        roomId,
        targetName,
        missing: [],
      } as Gap);
    if (!g.missing.includes(type)) g.missing.push(type);
    gapMap.set(key, g);
  };
  for (const l of listings ?? []) {
    const lname = listingNameById.get(l.id) ?? "Listing";
    const lrooms = allRooms.filter((r) => r.property_id === l.id);
    for (const type of WARN_TYPES) {
      if (wideByListing.get(l.id)?.has(type)) continue; // listing-wide covers all
      if (lrooms.length === 0) {
        addGap("listing", l.id, null, lname, type); // whole-listing needs it
        continue;
      }
      const without = lrooms.filter((r) => !roomScoped.has(`${r.id}:${type}`));
      if (without.length === 0) {
        // Every room covered per-room, but the property has no whole-listing one.
        addGap("listing", l.id, null, lname, type);
      } else {
        for (const r of without)
          addGap("room", l.id, r.id, (r.name as string) || "Room", type);
      }
    }
  }
  const coverageGaps = [...gapMap.values()];

  // Active policies per warn-type → options for the inline assign modal.
  const optionsByType: Record<string, { id: string; name: string }[]> = {};
  for (const p of policies ?? []) {
    if (p.status === "active" && WARN_TYPES.includes(p.type as PolicyType)) {
      (optionsByType[p.type] ??= []).push({ id: p.id, name: p.name });
    }
  }

  const cards: PolicyCard[] = (policies ?? []).map((p) => ({
    id: p.id,
    type: p.type as PolicyType,
    name: p.name,
    summary: p.summary,
    preset: p.preset,
    locked: isLockedPreset(p.preset),
    status: p.status as "active" | "draft",
    isDefault: p.is_default,
    isNonRefundable: p.is_non_refundable,
    checkInTime: p.check_in_time,
    checkOutTime: p.check_out_time,
    checkInMethod: (p.check_in_method as CheckInMethod | null) ?? null,
    petsAllowed: p.pets_allowed,
    smokingAllowed: p.smoking_allowed,
    partiesAllowed: p.parties_allowed,
    childrenWelcome: p.children_welcome,
    quietHoursStart: p.quiet_hours_start,
    quietHoursEnd: p.quiet_hours_end,
    version: p.version,
    updatedAt: p.updated_at,
    rules: rulesByPolicy.get(p.id) ?? [],
    bodyHtml: bodyByPolicy.get(p.id) ?? null,
    assignedCount: assignCount.get(p.id) ?? 0,
  }));

  // Listings (+ their rooms) for the in-manager "Assign" modal.
  const assignListings = (listings ?? []).map((l) => ({
    id: l.id,
    name: (l.name as string) || "Untitled listing",
    rooms: (rooms ?? [])
      .filter((r) => r.property_id === l.id)
      .map((r) => ({ id: r.id, name: (r.name as string) || "Room" })),
  }));
  const assignmentRows = (assignments ?? []).map((a) => ({
    property_id: a.property_id,
    room_id: a.room_id,
    policy_id: a.policy_id,
    policy_type: a.policy_type,
  }));

  return (
    <PolicyLibrary
      initial={cards}
      coverage={{
        roomsTotal,
        roomsWithCancellation,
        roomsWithHouseRules,
        fullyCovered,
      }}
      listings={assignListings}
      assignments={assignmentRows}
      coverageGaps={coverageGaps}
      optionsByType={optionsByType}
    />
  );
}
