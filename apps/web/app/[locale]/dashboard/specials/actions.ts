"use server";

import { revalidatePath } from "next/cache";

import { requireHost as getHost } from "@/lib/host/current";
import { slugify, uniqueSlug } from "@/lib/help/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { canUseSpecials } from "@/lib/specials/gate";

import { computeSpecialSavings } from "./_lib/savings";
import { specialInputSchema, type SpecialInput } from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const STATUS_PATH = "/dashboard/specials";

type PropertyTarget = { business_id: string; currency: string };

// ─── Date blocking helpers for fixed-date specials ────────────────────────
// When a fixed-date special is activated, its dates are blocked on the calendar
// so regular bookings can't overlap. The trigger handles releasing dates when
// the special leaves active status.

/**
 * Check if the dates for a fixed-date special are available.
 * For flexible-date specials, always returns true (dates are blocked at booking time).
 * Checks both blocked_dates AND existing bookings for the room/property.
 */
async function checkSpecialDatesAvailable(
  v: SpecialInput,
  excludeSpecialId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Only check for fixed-date specials being activated
  if (v.date_mode !== "fixed" || v.status !== "active") {
    return { ok: true };
  }
  if (!v.fixed_check_in || !v.fixed_check_out) {
    return {
      ok: false,
      error: "Fixed-date deals need check-in and check-out dates.",
    };
  }

  const admin = createAdminClient();
  const { data: available } = await admin.rpc("special_dates_available", {
    p_property_id: v.property_id,
    p_room_id: v.room_id ?? null,
    p_check_in: v.fixed_check_in,
    p_check_out: v.fixed_check_out,
    p_exclude_special_id: excludeSpecialId ?? null,
  });

  if (available === false) {
    // Try to get the conflicting booking reference for a better error message
    const { data: conflictRef } = await admin.rpc(
      "get_special_booking_conflict",
      {
        p_property_id: v.property_id,
        p_room_id: v.room_id ?? null,
        p_check_in: v.fixed_check_in,
        p_check_out: v.fixed_check_out,
      },
    );

    if (conflictRef) {
      return {
        ok: false,
        error: `Those dates overlap with booking ${conflictRef}. Choose different dates or set the deal as draft.`,
      };
    }
    return {
      ok: false,
      error:
        "Those dates are already booked or blocked. Choose different dates or set the deal as draft.",
    };
  }
  return { ok: true };
}

/**
 * Block calendar dates for an active fixed-date special.
 */
async function blockSpecialDates(
  specialId: string,
  v: SpecialInput,
): Promise<void> {
  // Only block for fixed-date specials being activated
  if (v.date_mode !== "fixed" || v.status !== "active") return;
  if (!v.fixed_check_in || !v.fixed_check_out) return;

  const admin = createAdminClient();
  await admin.rpc("block_special_dates", {
    p_special_id: specialId,
    p_property_id: v.property_id,
    p_room_id: v.room_id ?? null,
    p_check_in: v.fixed_check_in,
    p_check_out: v.fixed_check_out,
  });
}

/**
 * Release blocked dates for a special (used when dates change on an active special).
 */
async function releaseSpecialDates(specialId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("release_special_dates", { p_special_id: specialId });
}

// Resolve + ownership-check the chosen property in one round-trip. Returns the
// business_id + currency the special inherits (a special spans exactly one
// business — the one that owns the property — for banking/currency/language).
async function resolveProperty(
  supabase: ReturnType<typeof createServerClient>,
  propertyId: string,
  hostId: string,
): Promise<PropertyTarget | null> {
  const { data } = await supabase
    .from("properties")
    .select("business_id, currency")
    .eq("id", propertyId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

async function roomBelongsToProperty(
  supabase: ReturnType<typeof createServerClient>,
  roomId: string,
  propertyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("property_rooms")
    .select("id")
    .eq("id", roomId)
    .eq("property_id", propertyId)
    .maybeSingle();
  return !!data;
}

// Every referenced add-on must be the host's own (RLS would block the write
// anyway, but a clear error beats a silent failure).
async function addonsAreOwned(
  supabase: ReturnType<typeof createServerClient>,
  addonIds: string[],
  hostId: string,
): Promise<boolean> {
  if (addonIds.length === 0) return true;
  const { data } = await supabase
    .from("addons")
    .select("id")
    .eq("host_id", hostId)
    .in("id", addonIds);
  return (data?.length ?? 0) === addonIds.length;
}

async function policyIsOwned(
  supabase: ReturnType<typeof createServerClient>,
  policyId: string,
  hostId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("policies")
    .select("id")
    .eq("id", policyId)
    .eq("host_id", hostId)
    .eq("type", "cancellation")
    .maybeSingle();
  return !!data;
}

// Validate every foreign target the input points at. Returns ok or a friendly
// error — shared by create + update.
async function validateTargets(
  supabase: ReturnType<typeof createServerClient>,
  v: SpecialInput,
  hostId: string,
): Promise<
  { ok: true; target: PropertyTarget } | { ok: false; error: string }
> {
  const target = await resolveProperty(supabase, v.property_id, hostId);
  if (!target) return { ok: false, error: "That property isn’t one of yours." };

  if (
    v.room_id &&
    !(await roomBelongsToProperty(supabase, v.room_id, v.property_id))
  ) {
    return { ok: false, error: "That room doesn’t belong to this property." };
  }
  if (
    !(await addonsAreOwned(
      supabase,
      v.addons.map((a) => a.addon_id),
      hostId,
    ))
  ) {
    return { ok: false, error: "One of the add-ons isn’t one of yours." };
  }
  if (
    v.cancellation_policy_id &&
    !(await policyIsOwned(supabase, v.cancellation_policy_id, hostId))
  ) {
    return { ok: false, error: "That cancellation policy isn’t one of yours." };
  }
  return { ok: true, target };
}

// Build the specials row from validated input. `slug` is supplied separately
// (generated once at create, never changed on update — keeps public links stable).
function specialRow(v: SpecialInput, hostId: string, target: PropertyTarget) {
  const fixed = v.date_mode === "fixed";
  const flex = v.date_mode === "flexible";
  return {
    host_id: hostId,
    business_id: target.business_id,
    property_id: v.property_id,
    room_id: v.room_id,
    currency: target.currency,

    title: v.title.trim(),
    description: v.description?.trim() || null,
    hero_image_path: v.hero_image_path?.trim() || null,
    badge: v.badge?.trim() || null,

    date_mode: v.date_mode,
    fixed_check_in: fixed ? v.fixed_check_in : null,
    fixed_check_out: fixed ? v.fixed_check_out : null,
    window_start: flex ? v.window_start : null,
    window_end: flex ? v.window_end : null,
    min_nights: flex ? v.min_nights : null,
    max_nights: flex ? v.max_nights : null,

    price_mode: v.price_mode,
    flat_total: v.price_mode === "flat" ? v.flat_total : null,
    per_night_price: v.price_mode === "per_night" ? v.per_night_price : null,
    max_guests: v.max_guests,

    quantity: v.quantity,

    go_live_at: v.go_live_at,
    book_by: v.book_by,

    categories: v.categories,
    custom_tags: v.custom_tags,
    is_featured: v.is_featured,

    cancellation_policy_id: v.cancellation_policy_id,
    show_in_directory: v.show_in_directory,
    show_on_website: v.show_on_website,

    status: v.status,
  };
}

// Replace the special's add-on set with the input set (delete-all then insert).
// Single-editor flow, so the small window between the two writes is acceptable.
async function reconcileAddons(
  supabase: ReturnType<typeof createServerClient>,
  specialId: string,
  addons: SpecialInput["addons"],
): Promise<boolean> {
  const del = await supabase
    .from("special_addons")
    .delete()
    .eq("special_id", specialId);
  if (del.error) return false;
  if (addons.length === 0) return true;
  const rows = addons.map((a, i) => ({
    special_id: specialId,
    addon_id: a.addon_id,
    is_required: a.is_required,
    unit_price_override: a.unit_price_override,
    quantity: a.quantity ?? 1,
    sort_order: i,
  }));
  const ins = await supabase.from("special_addons").insert(rows);
  return !ins.error;
}

function parse(input: SpecialInput) {
  const parsed = specialInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  return { ok: true as const, value: parsed.data };
}

export async function createSpecialAction(
  input: SpecialInput,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await canUseSpecials(host.hostId))) {
    return { ok: false, error: "Specials aren't available on your plan." };
  }
  const p = parse(input);
  if (!p.ok) return p;
  const v = p.value;

  const supabase = createServerClient();
  const targets = await validateTargets(supabase, v, host.hostId);
  if (!targets.ok) return targets;

  // For fixed-date deals going live immediately, check if dates are available
  const availCheck = await checkSpecialDatesAvailable(v);
  if (!availCheck.ok) return availCheck;

  // Unique slug per host (active rows) from the title.
  const { data: existing } = await supabase
    .from("specials")
    .select("slug")
    .eq("host_id", host.hostId)
    .is("deleted_at", null);
  const slug = uniqueSlug(
    slugify(v.title) || "special",
    new Set((existing ?? []).map((r) => r.slug)),
  );

  // Savings badge — priced server-side now so the directory/website/detail
  // surfaces (S4/S5) read it straight off the row. Best-effort (nulls = no badge).
  const savings = await computeSpecialSavings(v, targets.target.currency);

  const { data, error } = await supabase
    .from("specials")
    .insert({
      ...specialRow(v, host.hostId, targets.target),
      slug,
      was_price: savings.wasPrice,
      savings_amount: savings.savingsAmount,
      savings_pct: savings.savingsPct,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Could not create the special. Try again." };
  }

  if (!(await reconcileAddons(supabase, data.id, v.addons))) {
    return {
      ok: false,
      error: "Saved the deal, but its add-ons didn't stick.",
    };
  }

  // Block calendar dates for active fixed-date deals
  await blockSpecialDates(data.id, v);

  revalidatePath(STATUS_PATH);
  return { ok: true, data: { id: data.id } };
}

export async function updateSpecialAction(
  specialId: string,
  input: SpecialInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await canUseSpecials(host.hostId))) {
    return { ok: false, error: "Specials aren't available on your plan." };
  }
  const p = parse(input);
  if (!p.ok) return p;
  const v = p.value;

  const supabase = createServerClient();
  const targets = await validateTargets(supabase, v, host.hostId);
  if (!targets.ok) return targets;

  // Load existing special to check for date/status changes
  const { data: oldSpecial } = await supabase
    .from("specials")
    .select("status, date_mode, fixed_check_in, fixed_check_out, room_id")
    .eq("id", specialId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oldSpecial) {
    return { ok: false, error: "Special not found." };
  }

  // For fixed-date deals being activated (or staying active with date changes),
  // check if the new dates are available
  const availCheck = await checkSpecialDatesAvailable(v, specialId);
  if (!availCheck.ok) return availCheck;

  // slug is immutable after create (public-link stability), so it's not patched.
  const { host_id: _host, ...patch } = specialRow(
    v,
    host.hostId,
    targets.target,
  );
  void _host;
  // Re-price the savings badge — pricing or date inputs may have changed.
  const savings = await computeSpecialSavings(v, targets.target.currency);
  const { error } = await supabase
    .from("specials")
    .update({
      ...patch,
      was_price: savings.wasPrice,
      savings_amount: savings.savingsAmount,
      savings_pct: savings.savingsPct,
    })
    .eq("id", specialId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "Could not save the special." };

  if (!(await reconcileAddons(supabase, specialId, v.addons))) {
    return {
      ok: false,
      error: "Saved the deal, but its add-ons didn't stick.",
    };
  }

  // Handle date blocking changes:
  // 1. If dates changed while active, release old blocks and create new ones
  // 2. If newly activated, create blocks
  // 3. If deactivated, the trigger handles releasing blocks
  const wasActive = oldSpecial.status === "active";
  const isActive = v.status === "active";
  const datesChanged =
    oldSpecial.date_mode !== v.date_mode ||
    oldSpecial.fixed_check_in !== v.fixed_check_in ||
    oldSpecial.fixed_check_out !== v.fixed_check_out ||
    oldSpecial.room_id !== v.room_id;

  if (
    wasActive &&
    isActive &&
    datesChanged &&
    oldSpecial.date_mode === "fixed"
  ) {
    // Dates changed on an active fixed-date deal: release old blocks first
    await releaseSpecialDates(specialId);
  }

  if (isActive && v.date_mode === "fixed") {
    // Block the new dates (or re-block after date change)
    if (!wasActive || datesChanged) {
      await blockSpecialDates(specialId, v);
    }
  }

  revalidatePath(STATUS_PATH);
  revalidatePath(`${STATUS_PATH}/${specialId}/edit`);
  return { ok: true };
}

// Lifecycle transitions the host triggers from the list (the cron handles
// auto-expiry). 'expired' is system-only and rejected here.
const HOST_STATUSES = ["draft", "active", "paused", "archived"] as const;
type HostStatus = (typeof HOST_STATUSES)[number];

export async function setSpecialStatusAction(
  specialId: string,
  status: HostStatus,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!HOST_STATUSES.includes(status)) {
    return { ok: false, error: "Unsupported status." };
  }
  const supabase = createServerClient();

  // Load the special to check if it's a fixed-date deal
  const { data: special } = await supabase
    .from("specials")
    .select(
      "status, date_mode, fixed_check_in, fixed_check_out, property_id, room_id",
    )
    .eq("id", specialId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!special) {
    return { ok: false, error: "Special not found." };
  }

  // When activating a fixed-date deal, check if dates are available
  if (
    status === "active" &&
    special.status !== "active" &&
    special.date_mode === "fixed"
  ) {
    if (!special.fixed_check_in || !special.fixed_check_out) {
      return {
        ok: false,
        error: "Fixed-date deals need check-in and check-out dates.",
      };
    }
    const admin = createAdminClient();
    const { data: available } = await admin.rpc("special_dates_available", {
      p_property_id: special.property_id,
      p_room_id: special.room_id ?? null,
      p_check_in: special.fixed_check_in,
      p_check_out: special.fixed_check_out,
      p_exclude_special_id: null,
    });
    if (available === false) {
      // Try to get the conflicting booking reference for a better error message
      const { data: conflictRef } = await admin.rpc(
        "get_special_booking_conflict",
        {
          p_property_id: special.property_id,
          p_room_id: special.room_id ?? null,
          p_check_in: special.fixed_check_in,
          p_check_out: special.fixed_check_out,
        },
      );

      if (conflictRef) {
        return {
          ok: false,
          error: `Those dates overlap with booking ${conflictRef}. You can't activate this deal until they're free.`,
        };
      }
      return {
        ok: false,
        error:
          "Those dates are already booked or blocked. You can't activate this deal until they're free.",
      };
    }
  }

  const { error } = await supabase
    .from("specials")
    .update({ status })
    .eq("id", specialId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "Could not update the special." };

  // Block dates when activating a fixed-date deal
  if (
    status === "active" &&
    special.status !== "active" &&
    special.date_mode === "fixed"
  ) {
    if (special.fixed_check_in && special.fixed_check_out) {
      const admin = createAdminClient();
      await admin.rpc("block_special_dates", {
        p_special_id: specialId,
        p_property_id: special.property_id,
        p_room_id: special.room_id ?? null,
        p_check_in: special.fixed_check_in,
        p_check_out: special.fixed_check_out,
      });
    }
  }
  // Note: The trigger handles releasing dates when status changes FROM active

  revalidatePath(STATUS_PATH);
  return { ok: true };
}

export async function deleteSpecialAction(
  specialId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  // Soft delete — a special may be referenced by bookings (FK), never hard-deleted.
  const { error } = await supabase
    .from("specials")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", specialId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "Could not delete the special." };
  revalidatePath(STATUS_PATH);
  return { ok: true };
}

// ─── Inline addon creation for specials ─────────────────────────────────────
// Creates a new addon inline (used when adding a custom extra to a special).
// If saveToLibrary is true, the addon is visible in the host's addon library.
// If false, it's hidden (is_active = false) and only used by this special.

export type InlineAddonInput = {
  name: string;
  unitPrice: number;
  currency: string;
  saveToLibrary: boolean;
};

export async function createInlineAddonAction(
  input: InlineAddonInput,
): Promise<
  ActionResult<{
    id: string;
    name: string;
    unitPrice: number;
    currency: string;
  }>
> {
  const host = await getHost();
  if (!host.ok) return host;

  const name = input.name.trim();
  if (!name || name.length > 120) {
    return { ok: false, error: "Name must be 1-120 characters." };
  }
  if (input.unitPrice < 0 || input.unitPrice > 10_000_000) {
    return { ok: false, error: "Price must be between 0 and 10,000,000." };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("addons")
    .insert({
      host_id: host.hostId,
      name,
      unit_price: input.unitPrice,
      currency: input.currency,
      pricing_model: "per_stay", // simplest model for specials
      is_active: input.saveToLibrary, // hidden from library if not saved
      is_required: false,
      min_quantity: 1,
    })
    .select("id, name, unit_price, currency")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the extra. Try again." };
  }

  return {
    ok: true,
    data: {
      id: data.id,
      name: data.name,
      unitPrice: Number(data.unit_price),
      currency: data.currency,
    },
  };
}
