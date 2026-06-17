"use server";

import { revalidatePath } from "next/cache";

import { assertBusinessOwnership } from "@/lib/business/resolveBusiness";
import { requireHost as resolveHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import {
  businessProfileSchema,
  personalAddressSchema,
  type BusinessProfileInput,
  type PersonalAddressInput,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const toNullable = (v: string | null | undefined) =>
  v && v.length > 0 ? v : null;

function profileRow(input: BusinessProfileInput) {
  return {
    trading_name: input.trading_name.trim(),
    legal_name: toNullable(input.legal_name),
    vat_number: toNullable(input.vat_number),
    company_registration_number: toNullable(input.company_registration_number),
    address_line1: toNullable(input.address_line1),
    address_line2: toNullable(input.address_line2),
    city: toNullable(input.city),
    municipality: toNullable(input.municipality),
    province: toNullable(input.province),
    postal_code: toNullable(input.postal_code),
    country: input.country.toUpperCase(),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    default_currency: input.default_currency,
    default_language: input.default_language,
  };
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

function revalidate() {
  revalidatePath("/dashboard/settings/businesses");
  revalidatePath("/dashboard/settings/banking");
  revalidatePath("/dashboard");
}

export async function createBusinessAction(
  input: BusinessProfileInput,
): Promise<CreateResult> {
  const parsed = businessProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const host = await resolveHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  // The host always has a default business (created on signup), so new ones are
  // never the default.
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      host_id: host.hostId,
      is_default: false,
      ...profileRow(parsed.data),
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Could not create the business." };
  }
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateBusinessAction(
  businessId: string,
  input: BusinessProfileInput,
): Promise<ActionResult> {
  const parsed = businessProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const host = await resolveHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  if (!(await assertBusinessOwnership(supabase, businessId, host.hostId))) {
    return { ok: false, error: "Business not found." };
  }

  const { error } = await supabase
    .from("businesses")
    .update(profileRow(parsed.data))
    .eq("id", businessId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not save the business." };
  revalidate();
  return { ok: true };
}

export async function setDefaultBusinessAction(
  businessId: string,
): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, is_archived")
    .eq("id", businessId)
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "Business not found." };
  if (biz.is_archived) {
    return {
      ok: false,
      error: "Restore the business before making it default.",
    };
  }

  // Clear the current default first — the partial unique index is one default
  // per host (non-archived).
  await supabase
    .from("businesses")
    .update({ is_default: false })
    .eq("host_id", host.hostId)
    .eq("is_default", true);

  const { error } = await supabase
    .from("businesses")
    .update({ is_default: true })
    .eq("id", businessId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not set the default business." };
  revalidate();
  return { ok: true };
}

export async function archiveBusinessAction(
  businessId: string,
): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, is_default")
    .eq("id", businessId)
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!biz) return { ok: false, error: "Business not found." };
  if (biz.is_default) {
    return {
      ok: false,
      error: "Set another business as default before archiving this one.",
    };
  }

  // A listing must always point to a live business — block archiving while any
  // listing is still assigned here.
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("deleted_at", null);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Reassign the ${count} listing(s) on this business first.`,
    };
  }

  const { error } = await supabase
    .from("businesses")
    .update({ is_archived: true })
    .eq("id", businessId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not archive the business." };
  revalidate();
  return { ok: true };
}

// ─── Per-business logo (branded financial documents) ──────────────
const LOGO_BUCKET = "host-logos";

export type LogoUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadBusinessLogoAction(
  businessId: string,
  formData: FormData,
): Promise<LogoUploadResult> {
  const host = await resolveHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  if (!(await assertBusinessOwnership(supabase, businessId, host.hostId))) {
    return { ok: false, error: "Business not found." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Logo must be under 5 MB." };
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const storagePath = `${host.hostId}/business-${businessId}/logo-${crypto.randomUUID()}.${ext}`;

  const { data: existing } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", businessId)
    .maybeSingle();

  const { error: upErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (upErr) return { ok: false, error: "Upload failed. Try a smaller file." };

  const { error: rowErr } = await supabase
    .from("businesses")
    .update({ logo_path: storagePath })
    .eq("id", businessId)
    .eq("host_id", host.hostId);
  if (rowErr) {
    await supabase.storage.from(LOGO_BUCKET).remove([storagePath]);
    return { ok: false, error: "Upload saved but record failed." };
  }

  if (existing?.logo_path && existing.logo_path !== storagePath) {
    await supabase.storage.from(LOGO_BUCKET).remove([existing.logo_path]);
  }

  const { data: pub } = supabase.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(storagePath);
  revalidate();
  return { ok: true, url: pub.publicUrl };
}

export async function removeBusinessLogoAction(
  businessId: string,
): Promise<ActionResult> {
  const host = await resolveHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  if (!(await assertBusinessOwnership(supabase, businessId, host.hostId))) {
    return { ok: false, error: "Business not found." };
  }
  const { data: existing } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", businessId)
    .maybeSingle();
  if (existing?.logo_path) {
    await supabase.storage.from(LOGO_BUCKET).remove([existing.logo_path]);
  }
  await supabase
    .from("businesses")
    .update({ logo_path: null })
    .eq("id", businessId)
    .eq("host_id", host.hostId);
  revalidate();
  return { ok: true };
}

// ─── Account holder's private address (internal only) ─────────────
export async function savePersonalAddressAction(
  input: PersonalAddressInput,
): Promise<ActionResult> {
  const parsed = personalAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const host = await resolveHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { error } = await supabase.from("host_personal_details").upsert(
    {
      host_id: host.hostId,
      address_line1: toNullable(parsed.data.address_line1),
      address_line2: toNullable(parsed.data.address_line2),
      city: toNullable(parsed.data.city),
      municipality: toNullable(parsed.data.municipality),
      province: toNullable(parsed.data.province),
      postal_code: toNullable(parsed.data.postal_code),
      country: parsed.data.country.toUpperCase(),
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    },
    { onConflict: "host_id" },
  );
  if (error) return { ok: false, error: "Could not save your address." };
  revalidatePath("/dashboard/settings/businesses");
  return { ok: true };
}
