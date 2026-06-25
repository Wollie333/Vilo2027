import { z } from "zod";

/**
 * Per-website, per-room media overrides for the room-detail page gallery (stored
 * on website_rooms.media_overrides). Shared by the loader, the publish snapshot,
 * the Media-tab UI and the save action.
 *
 *   hidden — property_photo ids to HIDE from this room's detail page (the photo
 *            still belongs to the room; it just isn't shown on the website).
 *   extra  — additional images (website-assets paths) added to the room page,
 *            with their own alt text.
 */
export const roomMediaExtraSchema = z.object({
  path: z.string().max(500),
  alt: z.string().max(300).optional(),
});

export const roomMediaOverridesSchema = z.object({
  hidden: z.array(z.string().max(64)).max(200).default([]),
  extra: z.array(roomMediaExtraSchema).max(60).default([]),
});

export type RoomMediaExtra = z.infer<typeof roomMediaExtraSchema>;
export type RoomMediaOverrides = z.infer<typeof roomMediaOverridesSchema>;

/** Parse stored jsonb into validated overrides (empty on anything malformed). */
export function parseRoomMediaOverrides(value: unknown): RoomMediaOverrides {
  const r = roomMediaOverridesSchema.safeParse(value ?? {});
  return r.success ? r.data : { hidden: [], extra: [] };
}
