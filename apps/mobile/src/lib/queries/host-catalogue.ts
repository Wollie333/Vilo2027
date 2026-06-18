import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Host catalogue & config (Phase 4). All reads + writes go straight through
// Supabase under RLS (the host can only see/edit their own rows) — no
// server-side money math here, so these are safe direct writes. Complex/money
// flows (publish gating, pricing recalc) stay in web Server Actions / Edge
// Functions and are intentionally NOT exposed as mobile writes.

type PhotoLike = { url: string; sort_order: number; room_id: string | null };

/** First property-level photo (room_id null), falling back to any photo. */
export function catalogueCover(p: {
  property_photos: PhotoLike[];
}): string | null {
  const photos = [...(p.property_photos ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return (photos.find((ph) => ph.room_id === null) ?? photos[0])?.url ?? null;
}

export type HostPropertyListItem = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  base_price: number | null;
  currency: string;
  is_published: boolean;
  property_type: string;
  property_photos: PhotoLike[];
};

const LIST_SELECT =
  "id, name, city, province, base_price, currency, is_published, property_type, property_photos(url, sort_order, room_id)";

async function fetchHostProperties(
  hostId: string,
): Promise<HostPropertyListItem[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(LIST_SELECT)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as HostPropertyListItem[];
}

export const catalogueKeys = {
  list: (hostId: string | undefined) =>
    ["host", "catalogue", "properties", hostId] as const,
  detail: (id: string | undefined) =>
    ["host", "catalogue", "property", id] as const,
};

/** All of the host's properties (catalogue list). DB is the source of truth. */
export function useHostCatalogue(hostId: string | undefined) {
  return useQuery({
    queryKey: catalogueKeys.list(hostId),
    queryFn: () => fetchHostProperties(hostId as string),
    enabled: !!hostId,
  });
}

// Scalar fields a host may edit directly from mobile (no money math, no gating).
export type EditableProperty = {
  id: string;
  name: string;
  description: string | null;
  property_type: string;
  base_price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  house_rules: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  city: string | null;
  province: string | null;
  is_published: boolean;
};

const EDIT_SELECT =
  "id, name, description, property_type, base_price, currency, bedrooms, bathrooms, max_guests, house_rules, check_in_time, check_out_time, city, province, is_published";

async function fetchEditableProperty(
  hostId: string,
  id: string,
): Promise<EditableProperty | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(EDIT_SELECT)
    .eq("id", id)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as EditableProperty | null) ?? null;
}

export function useEditableProperty(
  hostId: string | undefined,
  id: string | undefined,
) {
  return useQuery({
    queryKey: catalogueKeys.detail(id),
    queryFn: () => fetchEditableProperty(hostId as string, id as string),
    enabled: !!hostId && !!id,
  });
}

// Only the descriptive/config columns — pricing engine + publish gating stay server-side.
export type PropertyPatch = {
  name?: string;
  description?: string | null;
  base_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  max_guests?: number | null;
  house_rules?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  city?: string | null;
  province?: string | null;
};

/** Live update of a property's descriptive fields (RLS + explicit host scope). */
export function useUpdateProperty(hostId: string | undefined, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: PropertyPatch) => {
      const { error } = await supabase
        .from("properties")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("host_id", hostId ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogueKeys.detail(id) });
      qc.invalidateQueries({ queryKey: catalogueKeys.list(hostId) });
    },
  });
}
