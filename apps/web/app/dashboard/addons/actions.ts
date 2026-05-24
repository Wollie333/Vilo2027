"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import {
  addonInputSchema,
  listingAddonInputSchema,
  type AddonInput,
  type ListingAddonInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const PLAN_GATE_MSG = "Upgrade to Pro to use add-ons.";
const ADDON_BUCKET = "addon-images";

async function getHost(): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };
  return { ok: true, hostId: host.id, userId: user.id };
}

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
    .from("listings")
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
      is_required: parsed.data.is_required,
      is_active: parsed.data.is_active,
      lead_time_days: parsed.data.lead_time_days,
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: "Could not create add-on. Try again." };
  }

  revalidatePath("/dashboard/addons");
  return { ok: true, data: { id: row.id } };
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
      is_required: parsed.data.is_required,
      is_active: parsed.data.is_active,
      lead_time_days: parsed.data.lead_time_days,
    })
    .eq("id", addonId);
  if (error) {
    return { ok: false, error: "Could not save add-on." };
  }

  revalidatePath("/dashboard/addons");
  return { ok: true };
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
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Image must be under 8 MB." };
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
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertAddonsEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  if (!(await assertListingOwnership(listingId, host.hostId))) {
    return { ok: false, error: "Not your listing." };
  }
  if (!(await assertAddonOwnership(addonId, host.hostId))) {
    return { ok: false, error: "Not your add-on." };
  }

  const supabase = createServerClient();

  // Passing null = disable on this listing — wipe every scope row for this pair.
  if (input === null) {
    const { error } = await supabase
      .from("listing_addons")
      .delete()
      .eq("listing_id", listingId)
      .eq("addon_id", addonId);
    if (error) return { ok: false, error: "Could not disable add-on." };
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return { ok: true };
  }

  const parsed = listingAddonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields look wrong." };
  }

  // Single-scope semantics: an addon is either listing-wide OR scoped to one
  // room at a time per listing. Wipe other scopes for this pair before insert.
  await supabase
    .from("listing_addons")
    .delete()
    .eq("listing_id", listingId)
    .eq("addon_id", addonId);

  const { error } = await supabase.from("listing_addons").insert({
    listing_id: listingId,
    addon_id: addonId,
    room_id: parsed.data.room_id,
    unit_price_override: parsed.data.unit_price_override,
  });
  if (error) {
    return { ok: false, error: "Could not save add-on assignment." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
}
