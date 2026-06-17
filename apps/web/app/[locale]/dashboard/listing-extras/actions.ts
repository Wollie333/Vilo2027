"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

import {
  buildOverpassQuery,
  OVERPASS_ENDPOINT,
  parseOverpassResponse,
  type NearbyCandidate,
  type PoiCategory,
} from "./overpass";

export type ExtrasResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// All writes go through the user-scoped client, so the host_manage_* RLS
// policies enforce that the listing belongs to the signed-in host. No extra
// ownership check needed here. Feature gates (neighbourhood / review_themes)
// are seeded open on every plan pre-MVP (AGENT_RULES §3.4).

const poiSchema = z.object({
  property_id: z.string().uuid(),
  category: z.enum(["eat", "do", "travel"]),
  name: z.string().trim().min(1, "Add a name.").max(120),
  travel_time: z.string().trim().max(40).optional().nullable(),
});

const themeSchema = z.object({
  property_id: z.string().uuid(),
  label: z.string().trim().min(1, "Add a label.").max(60),
  icon_key: z.string().trim().min(1).max(40).default("sparkles"),
  mention_count: z.number().int().min(0).max(100000).nullable().optional(),
});

export async function createPoiAction(
  input: z.infer<typeof poiSchema>,
): Promise<ExtrasResult<{ id: string }>> {
  const parsed = poiSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_points_of_interest")
    .insert({
      property_id: parsed.data.property_id,
      category: parsed.data.category,
      name: parsed.data.name,
      travel_time: parsed.data.travel_time || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not add. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: { id: data.id } };
}

export async function deletePoiAction(id: string): Promise<ExtrasResult> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("property_points_of_interest")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not remove. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: undefined };
}

export async function createThemeAction(
  input: z.infer<typeof themeSchema>,
): Promise<ExtrasResult<{ id: string }>> {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_review_themes")
    .insert({
      property_id: parsed.data.property_id,
      label: parsed.data.label,
      icon_key: parsed.data.icon_key,
      mention_count: parsed.data.mention_count ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not add. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: { id: data.id } };
}

export async function deleteThemeAction(id: string): Promise<ExtrasResult> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("property_review_themes")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not remove. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data: undefined };
}

// ── Suggest nearby places (OpenStreetMap Overpass) ──────────────────────────
// Pulls real places around the listing's saved coordinates so the host can
// pick from a list instead of typing each one. Free + keyless. Nothing is
// saved here — the host selects in the picker, then createPoisBatchAction
// persists the chosen rows.

export async function suggestNearbyPlacesAction(
  listingId: string,
): Promise<ExtrasResult<Record<PoiCategory, NearbyCandidate[]>>> {
  if (!z.string().uuid().safeParse(listingId).success) {
    return { ok: false, error: "Invalid listing." };
  }
  const supabase = createServerClient();

  // RLS scopes this to listings the signed-in host can read.
  const { data: listing, error: listingErr } = await supabase
    .from("properties")
    .select("latitude, longitude")
    .eq("id", listingId)
    .maybeSingle();
  if (listingErr || !listing) {
    return { ok: false, error: "Could not load this listing." };
  }
  if (listing.latitude == null || listing.longitude == null) {
    return {
      ok: false,
      error: "Add this listing's location first, then try again.",
    };
  }

  // Names already on the listing, so suggestions don't repeat them.
  const { data: existingPoiRows } = await supabase
    .from("property_points_of_interest")
    .select("name")
    .eq("property_id", listingId);
  const existing = new Set(
    (existingPoiRows ?? []).map((r) => r.name.trim().toLowerCase()),
  );

  const lat = Number(listing.latitude);
  const lng = Number(listing.longitude);

  let json: unknown;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Vilo/1.0 (listing nearby-places suggester)",
      },
      body: `data=${encodeURIComponent(buildOverpassQuery(lat, lng))}`,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    json = await res.json();
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the places service. Try again, or add manually.",
    };
  }

  const data = parseOverpassResponse(json, lat, lng, existing);
  return { ok: true, data };
}

const batchSchema = z.object({
  property_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        category: z.enum(["eat", "do", "travel"]),
        name: z.string().trim().min(1).max(120),
        travel_time: z.string().trim().max(40).optional().nullable(),
      }),
    )
    .min(1)
    .max(60),
});

export async function createPoisBatchAction(
  input: z.infer<typeof batchSchema>,
): Promise<ExtrasResult<{ id: string; name: string }[]>> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const supabase = createServerClient();
  // One insert; host_manage_* RLS rejects rows for listings the host
  // doesn't own, same as createPoiAction.
  const { data, error } = await supabase
    .from("property_points_of_interest")
    .insert(
      parsed.data.items.map((it) => ({
        property_id: parsed.data.property_id,
        category: it.category,
        name: it.name,
        travel_time: it.travel_time || null,
      })),
    )
    .select("id, name");
  if (error || !data) return { ok: false, error: "Could not add. Try again." };
  revalidatePath("/dashboard/listing-extras");
  return { ok: true, data };
}
