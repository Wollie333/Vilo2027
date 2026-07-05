import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { resolveThemeBase } from "@/lib/site/themes.server";
import type { SiteNavigation } from "@/lib/site/types";

// DEV-ONLY live-render harness (no auth). Renders the REAL SiteChrome (header +
// footer + StickyHeader) that the published site uses — with a configurable nav
// (scrolled state, transparent-over-hero, a dropdown) and tall content — so header/
// footer design + the scrolled state can be VISUALLY VERIFIED on the shared live
// render path locally (BUSINESS_PRINCIPLES.md Principle #9). Not linked anywhere.
//
// Query params (all optional):
//   ?theme=oceansview|safari|sabela|marmalade   theme tokens (default oceansview)
//   &transparent=1                              transparent-over-hero header
//   &scrolledBg=%230E2C3A  &scrolledColor=%23fff  &scrolledBorder=%23...
//   &shadow=1                                   drop-shadow on scroll
//   &bg=%23ffffff                               solid header background
export const dynamic = "force-dynamic";

const THEMES = ["oceansview", "safari", "sabela", "marmalade"] as const;

export default async function DevChromePage({
  searchParams,
}: {
  searchParams?: Record<string, string | undefined>;
}) {
  const themeSlug = THEMES.includes(
    (searchParams?.theme ?? "") as (typeof THEMES)[number],
  )
    ? (searchParams?.theme as string)
    : "oceansview";
  const base = await resolveThemeBase(themeSlug);

  const transparent = searchParams?.transparent === "1";
  const shadow = searchParams?.shadow === "1";
  const shadowColor = searchParams?.shadowColor || "rgba(0,0,0,0.18)";
  const shadowSize = Number(searchParams?.shadowSize) || 18;
  const scrolledBg = searchParams?.scrolledBg || "#0E2C3A";
  const scrolledColor = searchParams?.scrolledColor || "#ffffff";
  const scrolledBorder =
    searchParams?.scrolledBorder || "rgba(255,255,255,0.15)";
  const bg = searchParams?.bg || undefined;

  const navigation: SiteNavigation = {
    menu: [
      { id: "m1", label: "Home", href: "/" },
      {
        id: "m2",
        label: "Rooms",
        href: "/rooms",
        children: [
          { id: "m2a", label: "Garden Suite", href: "/rooms/garden-suite" },
          { id: "m2b", label: "Family Cottage", href: "/rooms/family-cottage" },
          { id: "m2c", label: "The Loft", href: "/rooms/the-loft" },
        ],
      },
      { id: "m3", label: "About", href: "/about" },
      { id: "m4", label: "Journal", href: "/blog" },
      { id: "m5", label: "Contact", href: "/contact" },
    ],
    menuStyle: {
      scrolledColor,
      scrolledHoverColor: scrolledColor,
      submenuColor: "#0E2C3A",
      submenuHoverColor: "#0a7d4b",
      align:
        searchParams?.align === "center"
          ? "center"
          : searchParams?.align === "end"
            ? "end"
            : "start",
    },
    header: {
      sticky: true,
      transparentOverHero: transparent,
      bgColor: bg,
      scrolledBgColor: scrolledBg,
      scrolledBorderColor: scrolledBorder,
      scrolledShadow: shadow,
      scrolledShadowColor: shadowColor,
      scrolledShadowSize: shadowSize,
    },
    footer: {
      columns: [
        {
          id: "fc1",
          heading: "Explore",
          links: [
            { id: "f1", label: "Rooms", href: "/rooms" },
            { id: "f2", label: "About", href: "/about" },
          ],
        },
        {
          id: "fc2",
          heading: "Visit",
          links: [
            { id: "f3", label: "Contact", href: "/contact" },
            { id: "f4", label: "Journal", href: "/blog" },
          ],
        },
      ],
    },
  };

  return (
    <SiteThemeRoot theme={{ base }}>
      <SiteChrome
        brand={{
          name: "Live Harness Lodge",
          monogram: "L",
          contactEmail: "stay@example.com",
          contactPhone: "+27 21 000 0000",
          socials: { instagram: "harness", facebook: "harness" },
        }}
        nav={navigation.menu!.map((m) => ({ label: m.label, href: m.href }))}
        navigation={navigation}
        bookHref="#book"
        pageHasHero={transparent}
      >
        {/* A tall "hero" so a transparent header has something to overlay, then
            lots of content so the page scrolls and the scrolled state triggers. */}
        <section
          style={{
            minHeight: "80vh",
            background:
              "linear-gradient(120deg, var(--site-accent), var(--site-ink))",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center", padding: 24 }}>
            <h1 style={{ fontSize: 40, fontWeight: 700 }}>
              Scroll to test the header
            </h1>
            <p style={{ opacity: 0.85, marginTop: 8 }}>
              theme={themeSlug} · transparent={String(transparent)} · shadow=
              {String(shadow)}
            </p>
          </div>
        </section>
        {Array.from({ length: 12 }).map((_, i) => (
          <section
            key={i}
            style={{
              padding: "64px 20px",
              background: i % 2 ? "var(--site-surface)" : "var(--site-bg)",
              color: "var(--site-ink)",
            }}
          >
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              <h2
                style={{
                  fontFamily: "var(--site-font-heading)",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                Content block {i + 1}
              </h2>
              <p style={{ color: "var(--site-mute)", marginTop: 8 }}>
                Filler content so the page scrolls. Hover “Rooms” to check the
                dropdown link legibility; scroll up/down to check the header’s
                scrolled state (background, border, shadow, menu colour).
              </p>
            </div>
          </section>
        ))}
      </SiteChrome>
    </SiteThemeRoot>
  );
}
