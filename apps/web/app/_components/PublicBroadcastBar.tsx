"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import {
  PublicBroadcastClient,
  type PublicBroadcast,
} from "./PublicBroadcastClient";

// Client-side public announcement bar, mounted INSIDE SiteHeader so it always
// renders directly BELOW the public header (never above it). Fetches on the
// client via the anon key — the RLS policy broadcast_public_banner_select
// exposes public-surface, active-window banners (audience all/guests) to anon +
// authenticated visitors. Dismiss is per-browser (localStorage) inside
// PublicBroadcastClient.
export function PublicBroadcastBar() {
  const [broadcasts, setBroadcasts] = useState<PublicBroadcast[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("broadcast_announcements")
        .select(
          "id, severity, title, body, link_url, link_label, banner_dismiss_mode",
        )
        .eq("show_banner", true)
        .contains("banner_surfaces", ["public"])
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      if (cancelled) return;
      setBroadcasts(
        (data ?? []).map((r) => ({
          id: r.id as string,
          severity: r.severity as string,
          title: r.title as string,
          body: r.body as string,
          link_url: (r.link_url as string | null) ?? null,
          link_label: (r.link_label as string | null) ?? null,
          banner_dismiss_mode: r.banner_dismiss_mode as string,
        })),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!broadcasts || broadcasts.length === 0) return null;
  return <PublicBroadcastClient broadcasts={broadcasts} />;
}
