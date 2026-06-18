import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Host add-ons (extras a guest can buy with a booking). Host-owned (host_id),
// edited live through RLS — no money math here, the booking engine re-prices
// server-side. Pricing model is a fixed enum (see the DB CHECK constraint).

export const PRICING_MODELS = [
  "per_stay",
  "per_night",
  "per_guest",
  "per_guest_per_night",
  "per_couple",
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export type HostAddon = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  currency: string;
  category: string | null;
  pricing_model: string;
  is_active: boolean;
  sort_order: number;
};

const SELECT =
  "id, name, description, unit_price, currency, category, pricing_model, is_active, sort_order";

export const addonKeys = {
  list: (hostId: string | undefined) => ["host", "addons", hostId] as const,
  detail: (id: string | undefined) => ["host", "addon", id] as const,
};

async function fetchAddons(hostId: string): Promise<HostAddon[]> {
  const { data, error } = await supabase
    .from("addons")
    .select(SELECT)
    .eq("host_id", hostId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as HostAddon[];
}

export function useHostAddons(hostId: string | undefined) {
  return useQuery({
    queryKey: addonKeys.list(hostId),
    queryFn: () => fetchAddons(hostId as string),
    enabled: !!hostId,
  });
}

async function fetchAddon(
  hostId: string,
  id: string,
): Promise<HostAddon | null> {
  const { data, error } = await supabase
    .from("addons")
    .select(SELECT)
    .eq("id", id)
    .eq("host_id", hostId)
    .maybeSingle();
  if (error) throw error;
  return (data as HostAddon | null) ?? null;
}

export function useEditableAddon(
  hostId: string | undefined,
  id: string | undefined,
) {
  return useQuery({
    queryKey: addonKeys.detail(id),
    queryFn: () => fetchAddon(hostId as string, id as string),
    // "new" is the create sentinel — no fetch.
    enabled: !!hostId && !!id && id !== "new",
  });
}

export type AddonInput = {
  name: string;
  description: string | null;
  unit_price: number;
  pricing_model: PricingModel;
  category: string | null;
  is_active: boolean;
};

export function useCreateAddon(hostId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddonInput) => {
      if (!hostId) throw new Error("No host");
      const { error } = await supabase.from("addons").insert({
        host_id: hostId,
        currency: "ZAR",
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: addonKeys.list(hostId) }),
  });
}

export function useUpdateAddon(hostId: string | undefined, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddonInput) => {
      const { error } = await supabase
        .from("addons")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("host_id", hostId ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: addonKeys.detail(id) });
      qc.invalidateQueries({ queryKey: addonKeys.list(hostId) });
    },
  });
}

export function useDeleteAddon(hostId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("addons")
        .delete()
        .eq("id", id)
        .eq("host_id", hostId ?? "");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: addonKeys.list(hostId) }),
  });
}
