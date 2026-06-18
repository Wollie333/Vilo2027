import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  severity: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("in_app_notifications")
    .select("id, title, body, kind, severity, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

/** In-app notifications for the signed-in user (guest or host). */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId as string),
    enabled: !!userId,
  });
}

/** Mark a notification read — simple RLS-scoped update, in sync with web. */
export function useMarkNotificationRead(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("in_app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}
