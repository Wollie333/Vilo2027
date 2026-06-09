/**
 * Full-bleed layout rule — single source of truth.
 *
 * MOST logged-in pages render inside the standard content shell: padded
 * (px-5 py-6 / lg:px-8 lg:py-8) and capped at `max-w-[1280px]`, on a
 * page that grows and scrolls naturally (`min-h-screen`).
 *
 * A FULL-BLEED route breaks out of that shell entirely:
 *   • full content WIDTH — no horizontal padding, no max-width cap
 *   • full viewport HEIGHT — the content area is bounded to the viewport
 *     (`h-[100dvh] overflow-hidden`) so the page's own scroll regions and
 *     pinned elements (e.g. a chat composer) resolve instead of pushing
 *     the whole document down.
 *
 * THE RULE: the Inbox is full-bleed on BOTH dashboards — host
 * (`/dashboard/inbox`) and guest (`/portal/inbox`). The message-center UI
 * needs every pixel. EVERY OTHER logged-in page uses the standard shell.
 *
 * Both `app/dashboard/layout.tsx` and `app/portal/layout.tsx` import from
 * here, so the inbox can never silently revert to the padded shell on one
 * side while staying full-bleed on the other — change the rule in one
 * place or not at all.
 *
 * Add a route here ONLY if it is a genuine full-app surface that owns its
 * own height/scroll. Matching is EXACT, so child routes (e.g.
 * `/dashboard/inbox/templates`) intentionally keep the standard shell.
 */
export const FULL_BLEED_ROUTES = new Set<string>([
  "/dashboard/inbox",
  "/portal/inbox",
]);

export function isFullBleedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // The guest inbox is a two-pane chat (list + conversation), so an open
  // thread (/portal/inbox/<id>) is full-bleed too — the list lives in the
  // inbox layout and must fill the viewport alongside the conversation.
  if (pathname.startsWith("/portal/inbox/")) return true;
  return FULL_BLEED_ROUTES.has(pathname);
}
