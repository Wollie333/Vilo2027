import type { ReactNode } from "react";

/**
 * Room-detail page layout, matching the directory listing display
 * (`property/[slug]`): the photo gallery runs FULL-WIDTH at the top, then the
 * room content sits in a left column with the booking dock in a STICKY right rail
 * that starts BELOW the images and scrolls with the page. Stacks on mobile
 * (booking card below the content). Theme-agnostic; used on the public room page
 * (both themes) + the room-builder canvas so they match.
 *
 * NOTE: the inline <style> is rendered via dangerouslySetInnerHTML (NOT as
 * children) — a `>` child combinator in the CSS is escaped to `&gt;` by React on
 * the server only, tripping a `<style>` text-content hydration mismatch.
 */
export function RoomDockLayout({
  gallery,
  children,
  dock,
  below,
}: {
  /** Full-width section(s) shown above the 2-column grid (the room gallery). */
  gallery?: ReactNode;
  /** The room content — the left column of the grid (beside the booking dock). */
  children: ReactNode;
  /** The booking dock — the sticky right rail. */
  dock: ReactNode;
  /** Full-width section(s) shown BELOW the 2-column grid — reviews, location, the
   *  closing CTA — so they span the page instead of being trapped in the narrow
   *  content column beside the dock (matches the directory listing). */
  below?: ReactNode;
}) {
  return (
    <div className="room-dock-page">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .room-dock-grid{display:flex;gap:32px;align-items:flex-start;max-width:1280px;margin:8px auto 0;padding:0 20px;}
        .room-dock-grid .room-dock-main{flex:1;min-width:0;}
        .room-dock-grid .room-dock-main > * + *{margin-top:36px;}
        .room-dock-grid .room-dock-aside{width:360px;flex-shrink:0;}
        @media (max-width:1023px){
          .room-dock-grid{flex-direction:column;gap:24px;padding:0 14px;}
          .room-dock-grid .room-dock-main > * + *{margin-top:28px;}
          .room-dock-grid .room-dock-aside{width:100%;}
        }
      `,
        }}
      />
      {gallery}
      <div className="room-dock-grid">
        <div className="room-dock-main">{children}</div>
        {/* Same shared sticky-card rule as the checkout Summary. */}
        <aside className="room-dock-aside wielo-book-card-sticky">{dock}</aside>
      </div>
      {below ? <div className="room-dock-below">{below}</div> : null}
    </div>
  );
}
