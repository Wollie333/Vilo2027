"use server";

import { revalidatePath } from "next/cache";

import { requireHost as getHost } from "@/lib/host/current";
import { resolveListingHostContext } from "@/lib/host/adminListingHost";
import { createServerClient } from "@/lib/supabase/server";

import { z } from "zod";

import {
  addonInputSchema,
  listingAddonInputSchema,
  pricingModelSchema,
  type AddonInput,
  type ListingAddonInput,
  type PricingModel,
} from "./schemas";

// Minimal fields the inline listing-editor add-on form collects. Create fills
// the remaining columns with sensible defaults; edit patches ONLY these so a
// quick edit never clobbers advanced settings (stock, category, lead time…).
const addonFormSchema = z.object({
  name: z.string().trim().min(1, "Add a name.").max(120),
  pricing_model: pricingModelSchema,
  unit_price: z.number().min(0).max(1_000_000),
  is_active: z.boolean(),
});
export type AddonFormInput = z.infer<typeof addonFormSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const PLAN_GATE_MSG = "Upgrade to Pro to use add-ons.";
const ADDON_BUCKET = "addon-images";

async function assertAddonsEnabled(hostId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("check_feature_permission", {
    p_host_id: hostId,
    p_feature_key: "addons",
  });
  const result = data as { is_enabled: boolean } | null;
  return result?.is_enabled ?? false;
}

async function assertAddonOwnership(
  addonId: string,
  hostId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("addons")
    .select("id")
    .eq("id", addonId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}

async function assertListingOwnership(
  listingId: string,
  hostId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("id", listingId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}

export async function createAddonAction(
  input: AddonInput,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonsEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }

  const parsed = addonInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("addons")
    .select("sort_order")
    .eq("host_id", host.hostId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (existing?.sort_order ?? -1) + 1;

  const { data: row, error } = await supabase
    .from("addons")
    .insert({
      host_id: host.hostId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      pricing_model: parsed.data.pricing_model,
      unit_price: parsed.data.unit_price,
      currency: parsed.data.currency,
      min_quantity: parsed.data.min_quantity,
      max_quantity: parsed.data.max_quantity ?? null,
      allow_custom_quantity: parsed.data.allow_custom_quantity,
      stock_quantity: parsed.data.stock_quantity ?? null,
      is_required: parsed.data.is_required,
      is_active: parsed.data.is_active,
      lead_time_days: parsed.data.lead_time_days,
      category: parsed.data.category ?? null,
      vat_included: parsed.data.vat_included,
      daily_capacity: parsed.data.daily_capacity ?? null,
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error || !row) {
    return {
      ok: false,
      error: error
        ? `Could not create add-on: ${error.message}`
        : "Could not create add-on. Try again.",
    };
  }

  revalidatePath("/dashboard/addons");
  return { ok: true, data: { id: row.id } };
}

/** Create a blank draft add-on (hidden from guests) and return its id so the
 * archive can open the editor on it. */
export async function createDraftAddonAction(): Promise<
  ActionResult<{ id: string }>
> {
  return createAddonAction({
    name: "Untitled add-on",
    description: null,
    pricing_model: "per_stay",
    unit_price: 0,
    currency: "ZAR",
    min_quantity: 1,
    max_quantity: null,
    allow_custom_quantity: true,
    stock_quantity: null,
    is_required: false,
    is_active: false,
    lead_time_days: 0,
    category: null,
    vat_included: false,
    daily_capacity: null,
  });
}

export async function updateAddonAction(
  addonId: string,
  input: AddonInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonsEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  if (!(await assertAddonOwnership(addonId, host.hostId))) {
    return { ok: false, error: "Not your add-on." };
  }

  const parsed = addonInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("addons")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      pricing_model: parsed.data.pricing_model,
      unit_price: parsed.data.unit_price,
      currency: parsed.data.currency,
      min_quantity: parsed.data.min_quantity,
      max_quantity: parsed.data.max_quantity ?? null,
      allow_custom_quantity: parsed.data.allow_custom_quantity,
      stock_quantity: parsed.data.stock_quantity ?? null,
      is_required: parsed.data.is_required,
      is_active: parsed.data.is_active,
      lead_time_days: parsed.data.lead_time_days,
      category: parsed.data.category ?? null,
      vat_included: parsed.data.vat_included,
      daily_capacity: parsed.data.daily_capacity ?? null,
    })
    .eq("id", addonId);
  if (error) {
    // Surface the real cause so the host (and we) can see why a save fails —
    // e.g. a missing column if a migration hasn't applied, or a CHECK breach.
    return { ok: false, error: `Could not save add-on: ${error.message}` };
  }

  revalidatePath("/dashboard/addons");
  return { ok: true };
}

// ── Listing-context create & edit (owner OR admin) ───────────────
// Power the inline "add / edit add-on" affordance inside the listing editor.
// The host is derived from the listing, so these work for the owner AND for an
// active platform-staff member editing a user's listing (audited).

export type AddonRow = {
  id: string;
  name: string;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  isActive: boolean;
};

function toAddonRow(r: {
  id: string;
  name: string;
  pricing_model: string;
  unit_price: number | string;
  currency: string;
  is_active: boolean;
}): AddonRow {
  return {
    id: r.id,
    name: r.name,
    pricingModel: r.pricing_model as PricingModel,
    unitPrice: Number(r.unit_price),
    currency: r.currency,
    isActive: r.is_active,
  };
}

const ADDON_COLS =
  "id, name, pricing_model, unit_price, currency, is_active" as const;

export async function createAddonForListingAction(
  listingId: string,
  input: AddonFormInput,
): Promise<ActionResult<AddonRow>> {
  const ctx = await resolveListingHostContext(listingId, "addon.create");
  if (!ctx.ok) return ctx;
  if (!(await assertAddonsEnabled(ctx.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  const parsed = addonFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const { data: existing } = await ctx.db
    .from("addons")
    .select("sort_order")
    .eq("host_id", ctx.hostId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (existing?.sort_order ?? -1) + 1;
  const { data: row, error } = await ctx.db
    .from("addons")
    .insert({
      host_id: ctx.hostId,
      name: parsed.data.name,
      pricing_model: parsed.data.pricing_model,
      unit_price: parsed.data.unit_price,
      currency: "ZAR",
      is_active: parsed.data.is_active,
      sort_order: nextSort,
    })
    .select(ADDON_COLS)
    .single();
  if (error || !row) {
    return {
      ok: false,
      error: error
        ? `Could not create add-on: ${error.message}`
        : "Could not create add-on.",
    };
  }
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard/addons");
  return { ok: true, data: toAddonRow(row) };
}

export async function updateAddonForListingAction(
  listingId: string,
  addonId: string,
  input: AddonFormInput,
): Promise<ActionResult<AddonRow>> {
  const ctx = await resolveListingHostContext(listingId, "addon.update");
  if (!ctx.ok) return ctx;
  const { data: owns } = await ctx.db
    .from("addons")
    .select("id")
    .eq("id", addonId)
    .eq("host_id", ctx.hostId)
    .maybeSingle();
  if (!owns) return { ok: false, error: "Not your add-on." };

  const parsed = addonFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  // Patch ONLY the inline-editable columns — advanced settings are untouched.
  const { data: row, error } = await ctx.db
    .from("addons")
    .update({
      name: parsed.data.name,
      pricing_model: parsed.data.pricing_model,
      unit_price: parsed.data.unit_price,
      is_active: parsed.data.is_active,
    })
    .eq("id", addonId)
    .select(ADDON_COLS)
    .single();
  if (error || !row) {
    return {
      ok: false,
      error: error
        ? `Could not save add-on: ${error.message}`
        : "Could not save add-on.",
    };
  }
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard/addons");
  return { ok: true, data: toAddonRow(row) };
}

export async function deleteAddonAction(
  addonId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonOwnership(addonId, host.hostId))) {
    return { ok: false, error: "Not your add-on." };
  }

  const supabase = createServerClient();

  // Clean up the storage folder for this addon (best-effort).
  const { data: files } = await supabase.storage
    .from(ADDON_BUCKET)
    .list(addonId);
  if (files && files.length > 0) {
    await supabase.storage
      .from(ADDON_BUCKET)
      .remove(files.map((f) => `${addonId}/${f.name}`));
  }

  const { error } = await supabase.from("addons").delete().eq("id", addonId);
  if (error) {
    return { ok: false, error: "Could not delete add-on." };
  }

  revalidatePath("/dashboard/addons");
  return { ok: true };
}

export async function toggleAddonActiveAction(
  addonId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonOwnership(addonId, host.hostId))) {
    return { ok: false, error: "Not your add-on." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("addons")
    .update({ is_active: isActive })
    .eq("id", addonId);
  if (error) {
    return { ok: false, error: "Could not update add-on." };
  }
  revalidatePath("/dashboard/addons");
  return { ok: true };
}

export async function uploadAddonImageAction(
  addonId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string; path: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonOwnership(addonId, host.hostId))) {
    return { ok: false, error: "Not your add-on." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  // 4MB stays under the Vercel Server-Action body cap (~4.5MB); the client
  // guards the same so large files fail fast with a friendly message.
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Image must be under 4 MB." };
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }

  const supabase = createServerClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const storagePath = `${addonId}/${filename}`;

  const { data: existing } = await supabase
    .from("addons")
    .select("image_path")
    .eq("id", addonId)
    .single();

  const { error: upErr } = await supabase.storage
    .from(ADDON_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (upErr) {
    return { ok: false, error: "Upload failed. Try a smaller file." };
  }

  const { data: publicUrl } = supabase.storage
    .from(ADDON_BUCKET)
    .getPublicUrl(storagePath);

  const { error: rowErr } = await supabase
    .from("addons")
    .update({ image_path: storagePath })
    .eq("id", addonId);
  if (rowErr) {
    await supabase.storage.from(ADDON_BUCKET).remove([storagePath]);
    return { ok: false, error: "Upload saved but record failed." };
  }

  if (existing?.image_path) {
    await supabase.storage.from(ADDON_BUCKET).remove([existing.image_path]);
  }

  revalidatePath("/dashboard/addons");
  return { ok: true, data: { url: publicUrl.publicUrl, path: storagePath } };
}

export async function deleteAddonImageAction(
  addonId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonOwnership(addonId, host.hostId))) {
    return { ok: false, error: "Not your add-on." };
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("addons")
    .select("image_path")
    .eq("id", addonId)
    .single();
  if (!existing?.image_path) return { ok: true };

  const { error } = await supabase
    .from("addons")
    .update({ image_path: null })
    .eq("id", addonId);
  if (error) return { ok: false, error: "Could not remove image." };

  await supabase.storage.from(ADDON_BUCKET).remove([existing.image_path]);

  revalidatePath("/dashboard/addons");
  return { ok: true };
}

export async function setListingAddonAction(
  listingId: string,
  addonId: string,
  input: ListingAddonInput | null,
): Promise<ActionResult> {
  // Owner OR an active admin managing this user's listing (host derived from
  // the listing, so no session-host dependency for staff).
  const ctx = await resolveListingHostContext(listingId, "addon.assign");
  if (!ctx.ok) return ctx;
  if (!(await assertAddonsEnabled(ctx.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  const { data: ownsAddon } = await ctx.db
    .from("addons")
    .select("id")
    .eq("id", addonId)
    .eq("host_id", ctx.hostId)
    .maybeSingle();
  if (!ownsAddon) {
    return { ok: false, error: "Not your add-on." };
  }

  const supabase = ctx.db;

  // Passing null = disable on this listing — wipe every scope row for this pair.
  if (input === null) {
    const { error } = await supabase
      .from("property_addons")
      .delete()
      .eq("property_id", listingId)
      .eq("addon_id", addonId);
    if (error) return { ok: false, error: "Could not disable add-on." };
    revalidatePath(`/dashboard/properties/${listingId}/edit`);
    return { ok: true };
  }

  const parsed = listingAddonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields look wrong." };
  }

  // Single-scope semantics: an addon is either listing-wide OR scoped to one
  // room at a time per listing. Wipe other scopes for this pair before insert.
  await supabase
    .from("property_addons")
    .delete()
    .eq("property_id", listingId)
    .eq("addon_id", addonId);

  const { error } = await supabase.from("property_addons").insert({
    property_id: listingId,
    addon_id: addonId,
    room_id: parsed.data.room_id,
    unit_price_override: parsed.data.unit_price_override,
  });
  if (error) {
    return { ok: false, error: "Could not save add-on assignment." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  return { ok: true };
}

/** Multi-room availability control used by the add-on editor.
 * Replaces every `property_addons` scope row for (listing, addon) with the new
 * selection: off = no rows, all = one listing-wide row (room_id null), rooms =
 * one row per valid room. Distinct from `setListingAddonAction`, which keeps the
 * single-scope (one room OR listing-wide) semantics the listing editor relies on. */
export async function setAddonListingRoomsAction(
  addonId: string,
  listingId: string,
  selection:
    | { mode: "off" }
    | { mode: "all" }
    | { mode: "rooms"; roomIds: string[] },
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonsEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  if (!(await assertAddonOwnership(addonId, host.hostId))) {
    return { ok: false, error: "Not your add-on." };
  }
  if (!(await assertListingOwnership(listingId, host.hostId))) {
    return { ok: false, error: "Not your listing." };
  }

  const supabase = createServerClient();

  // Always start from a clean slate for this (listing, addon) pair.
  const { error: delErr } = await supabase
    .from("property_addons")
    .delete()
    .eq("property_id", listingId)
    .eq("addon_id", addonId);
  if (delErr) {
    return { ok: false, error: "Could not update availability." };
  }

  if (selection.mode === "off") {
    revalidatePath(`/dashboard/addons/${addonId}`);
    return { ok: true };
  }

  if (selection.mode === "all") {
    const { error } = await supabase.from("property_addons").insert({
      property_id: listingId,
      addon_id: addonId,
      room_id: null,
    });
    if (error) {
      return { ok: false, error: "Could not update availability." };
    }
    revalidatePath(`/dashboard/addons/${addonId}`);
    return { ok: true };
  }

  // mode === "rooms": keep only rooms that actually belong to this listing.
  const requested = Array.from(new Set(selection.roomIds));
  let validIds: string[] = [];
  if (requested.length > 0) {
    const { data: rooms } = await supabase
      .from("property_rooms")
      .select("id")
      .in("id", requested)
      .eq("property_id", listingId)
      .eq("is_active", true)
      .is("deleted_at", null);
    validIds = (rooms ?? []).map((row) => row.id);
  }

  // No valid rooms left → treat as "off" (rows already deleted above).
  if (validIds.length === 0) {
    revalidatePath(`/dashboard/addons/${addonId}`);
    return { ok: true };
  }

  const { error } = await supabase.from("property_addons").insert(
    validIds.map((roomId) => ({
      property_id: listingId,
      addon_id: addonId,
      room_id: roomId,
    })),
  );
  if (error) {
    return { ok: false, error: "Could not update availability." };
  }

  revalidatePath(`/dashboard/addons/${addonId}`);
  return { ok: true };
}
