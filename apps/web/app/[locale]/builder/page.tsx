import { getThemeBlueprints } from "@/lib/website/themeSections";
import { resolveThemeBase } from "@/lib/site/themes.server";
import { newPageDoc } from "@/lib/website/widgets/factories";

import { BuilderShell } from "./BuilderShell";
import "./builder-chrome.css";

// Builder V2 — Phase 3a–3c: the standalone, full-screen builder shell.
//
// Opens as its OWN page (not inside the Wielo dashboard chrome). This server
// route resolves the theme's TOKENS + the initial PageDoc (the page being
// edited) and hands both to the client shell, which owns the mutable doc store
// and renders the canvas itself (so structural edits reflect live).
//
// Dev entry for now: ?theme=<slug>&page=<key> (defaults to the Safari home
// blueprint). Real websiteId/pageId + server actions land in Phase 5–6.
export const dynamic = "force-dynamic";

const DEFAULT_THEME = "safari";

function themeName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default async function BuilderPage({
  searchParams,
}: {
  searchParams?: { theme?: string; page?: string };
}) {
  const slug = searchParams?.theme || DEFAULT_THEME;
  const blueprints = getThemeBlueprints(slug);
  const base = await resolveThemeBase(slug);
  const chosen =
    blueprints.find((b) => b.key === searchParams?.page) ?? blueprints[0];

  return (
    <BuilderShell
      docName={`${themeName(slug)} — ${chosen?.label ?? "Page"}`}
      themeLabel={themeName(slug)}
      themeBase={base}
      initialDoc={chosen?.doc ?? newPageDoc()}
    />
  );
}
