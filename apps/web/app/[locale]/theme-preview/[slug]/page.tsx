import "@/components/site/themes/theme-skins.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { PageDocRenderer } from "@/components/site/v2/PageDocRenderer";
import { sampleDataForDoc } from "@/lib/site/sampleSite";
import { resolveThemeBase } from "@/lib/site/themes.server";
import { getThemeTemplatePageDoc } from "@/lib/website/themeSections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Theme preview",
  // Sample-content design preview — never index it.
  robots: { index: false, follow: false },
};

// STANDALONE THEME PREVIEW — renders a theme's own demo home composition with
// sample content through the REAL section renderer (PageDocRenderer) + the scoped
// `.wielo-<slug>` skin, with NO host_websites row required. Embedded (iframe) by
// the setup wizard's theme step so a host previews the ACTUAL design + skin —
// the same render path the live site uses — instead of a bespoke mock. Bare route
// (sibling of /site, only the [locale] root layout wraps it) so it embeds clean.
//
// Sample data is BY DESIGN: this previews the DESIGN. The host's own words and
// photos are captured/bound later in the wizard's content step (Track 3).
export default async function ThemePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ accent?: string; name?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const accent = sp.accent?.trim();
  const siteName = sp.name?.trim() || "Your place";

  const doc = getThemeTemplatePageDoc(slug, `${slug}_home`);
  if (!doc) notFound();

  const data = sampleDataForDoc(doc);
  const base = await resolveThemeBase(slug);
  const theme = {
    preset: slug,
    base,
    ...(accent ? { colors: { accent } } : {}),
  };

  return (
    <SiteThemeRoot theme={theme}>
      <main style={{ minHeight: "100vh", background: "var(--site-bg)" }}>
        <PageDocRenderer
          doc={doc}
          data={data}
          brand={{ name: siteName }}
          interactive={false}
        />
      </main>
    </SiteThemeRoot>
  );
}
