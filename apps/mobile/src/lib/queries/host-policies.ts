import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Assign existing host policies to a property. We do NOT author policy content
// on mobile (that stays on web) — this only sets which of the host's policies
// applies property-wide, by writing the property_policies join the canonical
// resolver (resolve_listing_policy_id: room → property → host default) reads.
// Clearing an assignment falls back to the host default automatically.

// Per-property assignable policy slots (booking_terms + privacy are platform-wide).
export const POLICY_TYPES = [
  "cancellation",
  "house_rules",
  "check_in_out",
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export type PolicyOption = {
  id: string;
  name: string;
  type: string;
  summary: string | null;
  is_default: boolean;
};

export const policyKeys = {
  options: (hostId: string | undefined) =>
    ["host", "policies", hostId] as const,
  assignments: (propertyId: string | undefined) =>
    ["host", "property-policies", propertyId] as const,
};

async function fetchPolicyOptions(hostId: string): Promise<PolicyOption[]> {
  const { data, error } = await supabase
    .from("policies")
    .select("id, name, type, summary, is_default")
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as PolicyOption[];
}

/** All of the host's policies (grouped by type in the UI). */
export function useHostPolicies(hostId: string | undefined) {
  return useQuery({
    queryKey: policyKeys.options(hostId),
    queryFn: () => fetchPolicyOptions(hostId as string),
    enabled: !!hostId,
  });
}

/** Current property-wide assignments → map of policy_type → policy_id. */
async function fetchAssignments(
  propertyId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("property_policies")
    .select("policy_type, policy_id")
    .eq("property_id", propertyId)
    .is("room_id", null);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    map[r.policy_type] = r.policy_id;
  });
  return map;
}

export function usePropertyPolicies(propertyId: string | undefined) {
  return useQuery({
    queryKey: policyKeys.assignments(propertyId),
    queryFn: () => fetchAssignments(propertyId as string),
    enabled: !!propertyId,
  });
}

/**
 * Assign a policy to a property-wide slot, or clear it (policyId === null) to
 * fall back to the host default. Replaces any existing row for that slot.
 */
export function useAssignPolicy(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      policyType,
      policyId,
    }: {
      policyType: PolicyType;
      policyId: string | null;
    }) => {
      // Clear the existing property-wide assignment for this slot first.
      const { error: delErr } = await supabase
        .from("property_policies")
        .delete()
        .eq("property_id", propertyId)
        .eq("policy_type", policyType)
        .is("room_id", null);
      if (delErr) throw delErr;

      if (policyId) {
        const { error: insErr } = await supabase
          .from("property_policies")
          .insert({
            property_id: propertyId,
            policy_id: policyId,
            policy_type: policyType,
            room_id: null,
          });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: policyKeys.assignments(propertyId) }),
  });
}
