import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Host discount coupons. Host-owned (host_id), live RLS writes. The booking
// engine validates + applies redemptions server-side (redeem_coupon RPC); this
// screen only manages the coupon definitions. `scope` keeps its DB default.

export type DiscountType = "percent" | "fixed";

export type HostCoupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  currency: string;
  min_spend: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  is_active: boolean;
  description: string | null;
};

const SELECT =
  "id, code, discount_type, discount_value, currency, min_spend, max_redemptions, redeemed_count, is_active, description";

export const couponKeys = {
  list: (hostId: string | undefined) => ["host", "coupons", hostId] as const,
  detail: (id: string | undefined) => ["host", "coupon", id] as const,
};

async function fetchCoupons(hostId: string): Promise<HostCoupon[]> {
  const { data, error } = await supabase
    .from("coupons")
    .select(SELECT)
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HostCoupon[];
}

export function useHostCoupons(hostId: string | undefined) {
  return useQuery({
    queryKey: couponKeys.list(hostId),
    queryFn: () => fetchCoupons(hostId as string),
    enabled: !!hostId,
  });
}

async function fetchCoupon(
  hostId: string,
  id: string,
): Promise<HostCoupon | null> {
  const { data, error } = await supabase
    .from("coupons")
    .select(SELECT)
    .eq("id", id)
    .eq("host_id", hostId)
    .maybeSingle();
  if (error) throw error;
  return (data as HostCoupon | null) ?? null;
}

export function useEditableCoupon(
  hostId: string | undefined,
  id: string | undefined,
) {
  return useQuery({
    queryKey: couponKeys.detail(id),
    queryFn: () => fetchCoupon(hostId as string, id as string),
    enabled: !!hostId && !!id && id !== "new",
  });
}

export type CouponInput = {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_spend: number | null;
  max_redemptions: number | null;
  is_active: boolean;
  description: string | null;
};

export function useCreateCoupon(hostId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CouponInput) => {
      if (!hostId) throw new Error("No host");
      const { error } = await supabase
        .from("coupons")
        .insert({ host_id: hostId, currency: "ZAR", ...input });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: couponKeys.list(hostId) }),
  });
}

export function useUpdateCoupon(hostId: string | undefined, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CouponInput) => {
      const { error } = await supabase
        .from("coupons")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("host_id", hostId ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: couponKeys.detail(id) });
      qc.invalidateQueries({ queryKey: couponKeys.list(hostId) });
    },
  });
}

export function useDeleteCoupon(hostId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", id)
        .eq("host_id", hostId ?? "");
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: couponKeys.list(hostId) }),
  });
}
