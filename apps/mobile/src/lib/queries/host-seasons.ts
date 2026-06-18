import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Seasonal pricing rules per property (date-range price adjustments). Scoped to
// the host via an inner join on the owning property. The pricing engine applies
// these server-side at quote time; this screen only manages the rule rows.

export type AdjustmentType = "absolute" | "percent";

export type HostSeason = {
  id: string;
  property_id: string;
  label: string;
  start_date: string;
  end_date: string;
  adjustment_type: string;
  adjustment_value: number;
  currency: string;
  is_active: boolean;
};

const SELECT =
  "id, property_id, label, start_date, end_date, adjustment_type, adjustment_value, currency, is_active, properties!inner(host_id)";

export const seasonKeys = {
  list: (propertyId: string | undefined) =>
    ["host", "seasons", propertyId] as const,
  detail: (id: string | undefined) => ["host", "season", id] as const,
};

async function fetchSeasons(
  hostId: string,
  propertyId: string,
): Promise<HostSeason[]> {
  const { data, error } = await supabase
    .from("property_seasonal_pricing")
    .select(SELECT)
    .eq("property_id", propertyId)
    .eq("properties.host_id", hostId)
    .order("start_date");
  if (error) throw error;
  return (data ?? []) as unknown as HostSeason[];
}

export function useHostSeasons(
  hostId: string | undefined,
  propertyId: string | undefined,
) {
  return useQuery({
    queryKey: seasonKeys.list(propertyId),
    queryFn: () => fetchSeasons(hostId as string, propertyId as string),
    enabled: !!hostId && !!propertyId,
  });
}

async function fetchSeason(
  hostId: string,
  id: string,
): Promise<HostSeason | null> {
  const { data, error } = await supabase
    .from("property_seasonal_pricing")
    .select(SELECT)
    .eq("id", id)
    .eq("properties.host_id", hostId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as unknown as HostSeason) : null;
}

export function useEditableSeason(
  hostId: string | undefined,
  id: string | undefined,
) {
  return useQuery({
    queryKey: seasonKeys.detail(id),
    queryFn: () => fetchSeason(hostId as string, id as string),
    enabled: !!hostId && !!id && id !== "new",
  });
}

export type SeasonInput = {
  label: string;
  start_date: string;
  end_date: string;
  adjustment_type: AdjustmentType;
  adjustment_value: number;
  is_active: boolean;
};

export function useCreateSeason(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SeasonInput) => {
      const { error } = await supabase
        .from("property_seasonal_pricing")
        .insert({ property_id: propertyId, currency: "ZAR", ...input });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: seasonKeys.list(propertyId) }),
  });
}

export function useUpdateSeason(propertyId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SeasonInput) => {
      const { error } = await supabase
        .from("property_seasonal_pricing")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: seasonKeys.detail(id) });
      qc.invalidateQueries({ queryKey: seasonKeys.list(propertyId) });
    },
  });
}

export function useDeleteSeason(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("property_seasonal_pricing")
        .delete()
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: seasonKeys.list(propertyId) }),
  });
}

/** Validate a YYYY-MM-DD string. */
export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00`);
  return !Number.isNaN(d.getTime()) && v === d.toISOString().slice(0, 10);
}
