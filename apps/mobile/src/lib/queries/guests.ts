import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type HostGuest = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  tags: string[];
  blocked: boolean;
  notes: string | null;
  last_seen_at: string;
  last_stage: string | null;
  guest_id: string | null;
};

async function fetchHostGuests(hostId: string): Promise<HostGuest[]> {
  const { data, error } = await supabase
    .from("host_contacts")
    .select(
      "id, name, email, phone, tags, blocked, notes, last_seen_at, last_stage, guest_id",
    )
    .eq("host_id", hostId)
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HostGuest[];
}

/** A host's guest directory (CRM), backed by host_contacts. */
export function useHostGuests(hostId: string | undefined) {
  return useQuery({
    queryKey: ["host", "guests", hostId],
    queryFn: () => fetchHostGuests(hostId as string),
    enabled: !!hostId,
  });
}

async function fetchHostGuest(id: string): Promise<HostGuest | null> {
  const { data, error } = await supabase
    .from("host_contacts")
    .select(
      "id, name, email, phone, tags, blocked, notes, last_seen_at, last_stage, guest_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as HostGuest | null) ?? null;
}

export function useHostGuest(id: string | undefined) {
  return useQuery({
    queryKey: ["host", "guest", id],
    queryFn: () => fetchHostGuest(id as string),
    enabled: !!id,
  });
}

/** Save the host's private note on a guest — direct RLS-scoped write. */
export function useUpdateGuestNotes(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from("host_contacts")
        .update({ notes: notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["host", "guest", id] });
      qc.invalidateQueries({ queryKey: ["host", "guests"] });
    },
  });
}
