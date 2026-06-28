import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { loadRoomEditorData, loadSiteContext } from "@/lib/site/loadSitePage";
import type { RoomDetail } from "@/lib/site/types";
import { createServerClient } from "@/lib/supabase/server";
import type { RoomDetailOverride } from "@/lib/website/roomDetailOverride";
import type { WebsiteSection } from "@/lib/website/sections.schema";

export type RoomBuilderData = {
  websiteId: string;
  /** The room_detail template page id — the "Edit shared template" target. */
  pageId: string;
  roomId: string;
  roomName: string;
  /** Public slug for "Preview this room" (null if it can't be resolved). */
  roomSlug: string | null;
  subdomain: string;
  /** Active theme slug — gates SectionEditor's theme-specific fields. */
  themePreset: string;
  /** The shared template sections (read-only context in the room editor). */
  templateSections: WebsiteSection[];
  /** This room's current override (null = pure template). */
  override: RoomDetailOverride | null;
  /** The viewed room's live detail — injected into room-scoped sections so the
   *  canvas previews THIS room's real photos/price/amenities. */
  room: RoomDetail | null;
};

/**
 * Owner-scoped load for the per-room editor: the room's name/slug, the shared
 * template sections, and this room's current overrides. Returns null when the
 * website isn't owned by the host or the room isn't a visible member.
 */
export async function loadRoomBuilder(
  websiteId: string,
  pageId: string,
  roomId: string,
): Promise<RoomBuilderData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain, theme")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      subdomain: string;
      theme: { preset?: string } | null;
    }>();
  if (!site) return null;

  const ctx = await loadSiteContext(site.subdomain, { preview: true });
  if (!ctx) return null;

  const editor = await loadRoomEditorData(ctx, roomId);
  if (!editor) return null;

  return {
    websiteId,
    pageId,
    roomId,
    roomName: editor.name,
    roomSlug: editor.slug,
    subdomain: site.subdomain,
    themePreset: site.theme?.preset ?? ctx.theme.preset ?? "",
    templateSections: editor.templateSections,
    override: editor.override,
    room: editor.room,
  };
}
