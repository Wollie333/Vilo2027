import { RoomsPreviewSection } from "@/components/site/sections/RoomsPreviewSection";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { resolveThemeBase } from "@/lib/site/themes.server";
import { DEMO_ROOMS } from "@/lib/site/sampleSite";
import type { WebsiteSection } from "@/lib/website/sections.schema";
// theme-skins.css carries the container-responsive .wielo-cq-grid rules (loaded on
// live via SitePageView + in the canvas via builder/page); import it here to test.
import "@/components/site/themes/theme-skins.css";

// DEV-ONLY (no auth): renders the REAL rooms grid with demo data so its container
// responsiveness can be verified at phone/tablet/desktop widths (Principle #9/#10).
export const dynamic = "force-dynamic";

type RoomsProps = Extract<WebsiteSection, { type: "rooms_preview" }>["props"];

export default async function DevRoomsPage() {
  const base = await resolveThemeBase("oceansview");
  const props = { max: 6, layout: "grid" } as unknown as RoomsProps;
  return (
    <SiteThemeRoot theme={{ base }}>
      <div
        style={{
          background: "var(--site-bg)",
          minHeight: "100vh",
          padding: "48px 20px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <RoomsPreviewSection props={props} data={DEMO_ROOMS} />
        </div>
      </div>
    </SiteThemeRoot>
  );
}
