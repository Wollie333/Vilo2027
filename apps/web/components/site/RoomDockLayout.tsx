import type { ReactNode } from "react";

/**
 * Room-detail page layout, property-listing style: the room content (gallery +
 * sections) in the main column on the left, and the booking dock in a STICKY
 * right rail that starts beside the content and scrolls down with the page (it no
 * longer floats/overlaps the gallery). Stacks on mobile (booking card below the
 * content). Theme-agnostic; used on the public room page (both themes) and the
 * room-builder canvas so they match.
 *
 * NOTE: the inline <style> deliberately uses descendant selectors only (no `>`
 * child combinator) — React HTML-escapes `>` to `&gt;` server-side only, which
 * trips a hydration mismatch inside a <style>.
 */
export function RoomDockLayout({
  children,
  dock,
}: {
  children: ReactNode;
  dock: ReactNode;
}) {
  return (
    <div className="room-dock-wrap">
      <style>{`
        .room-dock-wrap{display:flex;gap:28px;align-items:flex-start;max-width:1280px;margin:0 auto;padding:20px 20px 0;}
        .room-dock-wrap .room-dock-main{flex:1;min-width:0;}
        .room-dock-wrap .room-dock-aside{width:332px;flex-shrink:0;position:sticky;top:96px;}
        @media (max-width:980px){
          .room-dock-wrap{flex-direction:column;gap:18px;padding:14px 14px 0;}
          .room-dock-wrap .room-dock-aside{position:static;width:100%;}
        }
      `}</style>
      <div className="room-dock-main">{children}</div>
      <aside className="room-dock-aside">{dock}</aside>
    </div>
  );
}
