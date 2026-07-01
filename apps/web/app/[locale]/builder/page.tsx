import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { PageDocRenderer } from "@/components/site/v2/PageDocRenderer";
import { getThemeBlueprints } from "@/lib/website/themeSections";
import { resolveThemeBase } from "@/lib/site/themes.server";

import { BuilderShell } from "./BuilderShell";
import "./builder-chrome.css";

// Builder V2 — Phase 3a: the standalone, full-screen builder shell.
//
// Opens as its OWN page (not inside the Wielo dashboard chrome). This server
// route assembles the themed PageDoc — the actual page being edited — and hands
// it to the client shell as a ready-rendered `stage` node, so the section render
// stays in the RSC tree while the client owns chrome + UI state.
//
// Dev entry for now: pick the page via ?theme=<slug>&page=<key> (defaults to the
// Safari home blueprint). Real websiteId/pageId + server actions land in Phase 5–6.
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

  const stage = chosen ? (
    <SiteThemeRoot theme={{ base }}>
      <PageDocRenderer doc={chosen.doc} device="desktop" />
    </SiteThemeRoot>
  ) : (
    <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
      No blueprint for “{slug}”.
    </div>
  );

  return (
    <BuilderShell
      docName={`${themeName(slug)} — ${chosen?.label ?? "Page"}`}
      themeLabel={themeName(slug)}
      stage={stage}
    />
  );
}
