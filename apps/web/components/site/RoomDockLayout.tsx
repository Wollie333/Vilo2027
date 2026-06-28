import type { ReactNode } from "react";

/**
 * Room-detail page layout, matching the directory listing display
 * (`property/[slug]`): the photo gallery runs FULL-WIDTH at the top, then the
 * room content sits in a left column with the booking dock in a STICKY right rail
 * that starts BELOW the images and scrolls with the page. Stacks on mobile
 * (booking card below the content). Theme-agnostic; used on the public room page
 * (both themes) + the room-builder canvas so they match.
 *
 * NOTE: the inline <style> uses descendant selectors only (no `>` child
 * combinator) — React escapes `>` to `&gt;` server-side only, tripping a
 * hydration mismatch inside a <style>.
 */
export function RoomDockLayout({
  gallery,
  children,
  dock,
}: {
  /** Full-width section(s) shown above the 2-column grid (the room gallery). */
  gallery?: ReactNode;
  /** The room content — the left column of the grid. */
  children: ReactNode;
  /** The booking dock — the sticky right rail. */
  dock: ReactNode;
}) {
  return (
    <div className="room-dock-page">
      <style>{`
        .room-dock-grid{display:flex;gap:32px;align-items:flex-start;max-width:1280px;margin:8px auto 0;padding:0 20px;}
        .room-dock-grid .room-dock-main{flex:1;min-width:0;}
        .room-dock-grid .room-dock-aside{width:340px;flex-shrink:0;position:sticky;top:var(--vilo-sticky-top,110px);}
        @media (max-width:980px){
          .room-dock-grid{flex-direction:column;gap:18px;padding:0 14px;}
          .room-dock-grid .room-dock-aside{position:static;width:100%;}
        }
      `}</style>
      {gallery}
      <div className="room-dock-grid">
        <div className="room-dock-main">{children}</div>
        <aside className="room-dock-aside">{dock}</aside>
      </div>
    </div>
  );
}
