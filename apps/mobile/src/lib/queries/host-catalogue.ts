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

// ── Host profile (Settings) ───────────────────────────────────────────
// The host's own public-facing profile fields. RLS lets a host edit only their
// own row. Banking / payout config is intentionally NOT exposed on mobile.

export type HostProfilePatch = {
  display_name?: string;
  bio?: string | null;
  website_url?: string | null;
};

/** Live update of the host's public profile. RLS scopes to the owner. */
export function useUpdateHostProfile(hostId: string | undefined) {
  return useMutation({
    mutationFn: async (patch: HostProfilePatch) => {
      const { error } = await supabase
        .from("hosts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", hostId ?? "");
      if (error) throw error;
    },
  });
}

// ── Reviews (host responses) ──────────────────────────────────────────
// Reviews are immutable once published (a DB trigger protects the content);
// the host may only append/edit their public response. Scoped by host_id.

export type HostReview = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  trip_type: string | null;
  host_response: string | null;
  host_responded_at: string | null;
};

async function fetchHostReviews(hostId: string): Promise<HostReview[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, rating, body, created_at, trip_type, host_response, host_responded_at",
    )
    .eq("host_id", hostId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as HostReview[];
}

export const reviewKeys = {
  list: (hostId: string | undefined) => ["host", "reviews", hostId] as const,
};

/** Published reviews across the host's properties. */
export function useHostReviews(hostId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.list(hostId),
    queryFn: () => fetchHostReviews(hostId as string),
    enabled: !!hostId,
  });
}

/** Write (or edit) the host's public response to a review. RLS-scoped. */
export function useRespondToReview(hostId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      response,
    }: {
      reviewId: string;
      response: string;
    }) => {
      const trimmed = response.trim();
      const { error } = await supabase
        .from("reviews")
        .update({
          host_response: trimmed || null,
          host_responded_at: trimmed ? new Date().toISOString() : null,
        })
        .eq("id", reviewId)
        .eq("host_id", hostId ?? "");
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: reviewKeys.list(hostId) }),
  });
}

// ── Rooms ────────────────────────────────────────────────────────────
// A property's rooms. Host-scoped via an inner join on the owning property so
// a host only ever sees/edits rooms under their own properties.

export type HostRoom = {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  base_price: number;
  currency: string;
  max_guests: number;
  bed_type: string | null;
  inventory_count: number;
  is_active: boolean;
  sort_order: number;
};

const ROOM_SELECT =
  "id, property_id, name, description, base_price, currency, max_guests, bed_type, inventory_count, is_active, sort_order, properties!inner(host_id)";

export const roomKeys = {
  list: (propertyId: string | undefined) =>
    ["host", "catalogue", "rooms", propertyId] as const,
  detail: (id: string | undefined) =>
    ["host", "catalogue", "room", id] as const,
};

async function fetchRooms(
  hostId: string,
  propertyId: string,
): Promise<HostRoom[]> {
  const { data, error } = await supabase
    .from("property_rooms")
    .select(ROOM_SELECT)
    .eq("property_id", propertyId)
    .eq("properties.host_id", hostId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw error;
  // The inner `properties` join is only a host-ownership filter; ignore it.
  return (data ?? []) as unknown as HostRoom[];
}

/** Rooms under one of the host's properties. */
export function useHostRooms(
  hostId: string | undefined,
  propertyId: string | undefined,
) {
  return useQuery({
    queryKey: roomKeys.list(propertyId),
    queryFn: () => fetchRooms(hostId as string, propertyId as string),
    enabled: !!hostId && !!propertyId,
  });
}

async function fetchRoom(hostId: string, id: string): Promise<HostRoom | null> {
  const { data, error } = await supabase
    .from("property_rooms")
    .select(ROOM_SELECT)
    .eq("id", id)
    .eq("properties.host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as unknown as HostRoom) : null;
}

export function useEditableRoom(
  hostId: string | undefined,
  id: string | undefined,
) {
  return useQuery({
    queryKey: roomKeys.detail(id),
    queryFn: () => fetchRoom(hostId as string, id as string),
    enabled: !!hostId && !!id,
  });
}

export type RoomPatch = {
  name?: string;
  description?: string | null;
  base_price?: number;
  max_guests?: number;
  bed_type?: string | null;
  inventory_count?: number;
  is_active?: boolean;
};

/** Live update of a room's descriptive fields. RLS enforces host ownership. */
export function useUpdateRoom(
  hostId: string | undefined,
  propertyId: string,
  roomId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: RoomPatch) => {
      const { error } = await supabase
        .from("property_rooms")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", roomId)
        .eq("property_id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
      qc.invalidateQueries({ queryKey: roomKeys.list(propertyId) });
    },
  });
}
