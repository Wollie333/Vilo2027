"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  category_id: string;
  severity: "info" | "default" | "high" | "critical";
  payload: Record<string, unknown> | null;
};

const LIST_LIMIT = 30;

export function useNotifications() {
  const supabase = React.useMemo(() => createClient(), []);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("in_app_notifications")
      .select(
        "id, kind, title, body, link, read_at, created_at, category_id, severity, payload",
      )
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems(data as AppNotification[]);
    }
    setLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    let mounted = true;
    refresh();

    const channel = supabase
      .channel("in_app_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "in_app_notifications" },
        (msg) => {
          if (!mounted) return;
          setItems((prev) =>
            [msg.new as AppNotification, ...prev].slice(0, LIST_LIMIT),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "in_app_notifications" },
        (msg) => {
          if (!mounted) return;
          const updated = msg.new as AppNotification;
          setItems((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item)),
          );
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [refresh, supabase]);

  const unreadCount = items.filter((item) => !item.read_at).length;

  // Derive the category tabs from the loaded items, preserving order and
  // showing per-category unread counts. The "all" tab is always present.
  const categories = React.useMemo(() => {
    const seen = new Map<
      string,
      { id: string; unread: number; total: number }
    >();
    for (const it of items) {
      const cur = seen.get(it.category_id) ?? {
        id: it.category_id,
        unread: 0,
        total: 0,
      };
      cur.total += 1;
      if (!it.read_at) cur.unread += 1;
      seen.set(it.category_id, cur);
    }
    return Array.from(seen.values());
  }, [items]);

  const markRead = React.useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id && !item.read_at
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
      await supabase
        .from("in_app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
    },
    [supabase],
  );

  const markAllRead = React.useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: now })),
    );
    await supabase
      .from("in_app_notifications")
      .update({ read_at: now })
      .is("read_at", null);
  }, [supabase]);

  return {
    items,
    categories,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
