import { SearchResultsSection } from "@/components/site/sections/SearchResultsSection";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { resolveThemeBase } from "@/lib/site/themes.server";
import "@/components/site/themes/theme-skins.css";

// DEV-ONLY (no auth): renders the REAL SearchResultsSection (demo cards, since
// interactive=false) under a theme, so the search-results design + spacing can be
// VISUALLY VERIFIED on the live render path locally (Principle #9). ?theme=<slug>.
export const dynamic = "force-dynamic";

const THEMES = ["oceansview", "safari", "hotel", "marmalade"] as const;

export default async function DevSearchPage({
  searchParams,
}: {
  searchParams?: { theme?: string };
}) {
  const themeSlug = THEMES.includes(
    (searchParams?.theme ?? "") as (typeof THEMES)[number],
  )
    ? (searchParams?.theme as string)
    : "oceansview";
  const base = await resolveThemeBase(themeSlug);
  return (
    <SiteThemeRoot theme={{ base }}>
      <div style={{ background: "var(--site-bg)", minHeight: "100vh" }}>
        <SearchResultsSection
          props={{
            heading: "Available stays",
            body: "Choose your dates to see what’s open — book direct for the best rate.",
          }}
          interactive={false}
        />
      </div>
    </SiteThemeRoot>
  );
}
