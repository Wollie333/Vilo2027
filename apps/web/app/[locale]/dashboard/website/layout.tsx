import type { ReactNode } from "react";

// Loads the Website-CMS design system (Phase 0 of the CMS redesign). Both
// stylesheets are generated from the approved mockups (scripts/scope-css.mjs)
// and every rule is scoped under a wrapper class — `.vilo-cms` for the dashboard
// tab pages, `.vilo-builder` for the full-screen editors, `.vilo-nav` for the
// header/menu/footer preview chrome (usable inside either) — so the emerald
// system never leaks into the rest of the app. Screens opt in by adding the
// wrapper class to their root; importing here only bundles the CSS for
// /dashboard/website.
import "./cms.css";
import "./builder.css";
import "./nav.css";

export default function WebsiteCmsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
