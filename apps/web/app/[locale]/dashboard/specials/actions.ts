"use server";

import { revalidatePath } from "next/cache";

import { requireHost as getHost } from "@/lib/host/current";
import { slugify, uniqueSlug } from "@/lib/help/slug";
import { createServerClient } from "@/lib/supabase/server";

import { canUseSpecials } from "@/lib/specials/gate";

import { computeSpecialSavings } from "./_lib/savings";
import { specialInputSchema, type SpecialInput } from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const STATUS_PATH = "/dashboard/specials";

type PropertyTarget = { business_id: string; currency: string };

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
    return { ok: false, error: "Specials aren’t available on your plan." };
  }
  const p = parse(input);
  if (!p.ok) return p;
  const v = p.value;

  const supabase = createServerClient();
  const targets = await validateTargets(supabase, v, host.hostId);
  if (!targets.ok) return targets;

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
      error: "Saved the deal, but its add-ons didn’t stick.",
    };
  }

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
    return { ok: false, error: "Specials aren’t available on your plan." };
  }
  const p = parse(input);
  if (!p.ok) return p;
  const v = p.value;

  const supabase = createServerClient();
  const targets = await validateTargets(supabase, v, host.hostId);
  if (!targets.ok) return targets;

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
      error: "Saved the deal, but its add-ons didn’t stick.",
    };
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
  const { error } = await supabase
    .from("specials")
    .update({ status })
    .eq("id", specialId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "Could not update the special." };
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
