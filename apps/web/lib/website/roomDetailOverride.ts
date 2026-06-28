import { z } from "zod";

import {
  sectionSchema,
  type WebsiteSection,
} from "@/lib/website/sections.schema";

/**
 * Per-room detail overrides — the host's OPTIONAL customization for a single room,
 * layered over the shared `room_detail` template. Stored on
 * `website_rooms.detail_overrides` (jsonb). Empty/absent = the room renders the
 * pure template (the common case), so the template keeps driving the design and
 * its edits propagate to every room. A room only diverges where the host edits it.
 *
 * Foundation, theme-agnostic: this lives at the sections layer, so every theme
 * renders per-room overrides for free (the same SectionRenderer / Safari path).
 *
 *  - `hidden`   — template section ids dropped for THIS room.
 *  - `replaced` — template section id → a replacement section for THIS room.
 *  - `extras`   — extra sections appended after the template for THIS room.
 */
export const roomDetailOverrideSchema = z.object({
  hidden: z.array(z.string().min(1)).max(60).default([]),
  replaced: z.record(z.string(), sectionSchema).default({}),
  extras: z.array(sectionSchema).max(40).default([]),
});

export type RoomDetailOverride = z.infer<typeof roomDetailOverrideSchema>;

/** True when an override actually changes anything (vs an empty/absent bag). A
 *  pure-template room stores nothing, so we can skip the merge entirely. */
export function hasRoomOverride(
  o: RoomDetailOverride | null | undefined,
): boolean {
  return (
    !!o &&
    (o.hidden.length > 0 ||
      Object.keys(o.replaced).length > 0 ||
      o.extras.length > 0)
  );
}

/**
 * Safely parse the stored jsonb into a RoomDetailOverride, returning null when
 * absent or malformed (so a bad/legacy value never breaks a room page — it just
 * falls back to the pure template).
 */
export function parseRoomDetailOverride(
  raw: unknown,
): RoomDetailOverride | null {
  if (raw == null) return null;
  const parsed = roomDetailOverrideSchema.safeParse(raw);
  if (!parsed.success) return null;
  return hasRoomOverride(parsed.data) ? parsed.data : null;
}

/**
 * Merge the shared template sections with one room's overrides into the ordered
 * section list to render for that room. Pure (no IO): the caller supplies the
 * template (already resolved) and the parsed override. Order = template (minus
 * hidden, with replacements swapped in place) followed by the room's extras.
 *
 * Template section ids are stable, so an override keyed to a since-removed
 * template section is simply ignored — the template stays the source of truth.
 */
export function mergeRoomDetailSections(
  template: WebsiteSection[],
  override: RoomDetailOverride | null | undefined,
): WebsiteSection[] {
  if (!override) return template;
  const hidden = new Set(override.hidden);
  const base = template
    .filter((s) => !hidden.has(s.id))
    .map((s) => override.replaced[s.id] ?? s);
  return override.extras.length ? [...base, ...override.extras] : base;
}
