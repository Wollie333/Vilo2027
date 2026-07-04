import {
  themeFontKeys,
  type SiteFont,
  type SiteThemeConfig,
} from "@/lib/site/themes";

/**
 * Loads a themed site's DISPLAY web fonts on the public site.
 *
 * `FONT_STACKS` lists each theme font's family first (e.g. Cormorant Garamond,
 * Bricolage Grotesque) with system fallbacks, but the public `/site` route never
 * loaded those web fonts — so themed headings silently fell back to the system
 * serif/sans (Safari's Cormorant → Georgia, etc.). We emit the matching Google
 * Fonts stylesheet for the theme's effective heading/body font keys, so the live
 * site renders the SAME fonts as the pixel-perfect reference. `display=swap` keeps
 * text visible while the font loads. Only the three keys with actual web fonts
 * need loading; `sans`/`serif`/`editorial` use system fonts (no request).
 *
 * `<link rel="stylesheet">` hoists to <head> in the App Router, so this can render
 * anywhere in the themed subtree (it lives in `SiteThemeRoot`).
 */
const WEBFONT_HREFS: Partial<Record<SiteFont, string>> = {
  elegant:
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap",
  grotesk:
    "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Manrope:wght@400;500;600;700;800&display=swap",
  homely:
    "https://fonts.googleapis.com/css2?family=Gloock&family=Karla:wght@400;500;600;700&display=swap",
};

export function SiteFontLinks({
  theme,
}: {
  theme: SiteThemeConfig | null | undefined;
}) {
  const { heading, body } = themeFontKeys(theme);
  const hrefs = Array.from(
    new Set(
      [WEBFONT_HREFS[heading], WEBFONT_HREFS[body]].filter(Boolean) as string[],
    ),
  );
  if (hrefs.length === 0) return null;
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {hrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}
