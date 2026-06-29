import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SafariShell } from "@/components/site/safari/SafariShell";
import { buildSafariNav } from "@/lib/site/safariNav";
import {
  SafariSectionList,
  type SafariCtx,
} from "@/components/site/sections/SafariSections";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteImg } from "@/components/site/SiteImg";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { siteAsset } from "@/components/site/SitePageView";
import {
  buildSitePreviewPages,
  loadSiteBlogIndex,
  loadSiteContext,
  loadSitePage,
  resolveSiteRef,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { siteMetadata } from "@/lib/site/metadata";
import { siteSurfaceIsDark } from "@/lib/site/themes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; preview?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const h = await headers();
  const meta = await siteMetadata({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
    pathSlug: ["blog"],
    preview: sp?.preview === "1",
  });
  // Override with blog-specific title
  return {
    ...meta,
    title: meta.title ? `Blog · ${meta.title}` : "Blog",
  };
}

export default async function SiteBlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; preview?: string; theme?: string }>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();

  const preview = sp?.preview === "1";
  const ctx = await loadSiteContext(ref, { preview, themeSlug: sp?.theme });
  if (!ctx) notFound();

  const posts = await loadSiteBlogIndex(ctx);

  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;

  if ((ctx.previewThemeSlug ?? ctx.theme.preset) === "safari") {
    // Section-driven (live === builder): the Journal page is editable like every
    // other Safari page. Its blog_preview band binds to the real posts that
    // loadSitePage already assembles for the "blog" page.
    const result = await loadSitePage(ctx, ["blog"]);
    const sections = result?.sections ?? [];
    const nav = buildSafariNav(ctx);
    const navLinks = nav.links;
    const roomsHref =
      navLinks.find((l) => /suite|room/i.test(l.label))?.href || "#suites";
    const bookHref =
      ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined;
    const safariCtx: SafariCtx = {
      brandName: ctx.brand.name,
      contactEmail: ctx.brand.contactEmail,
      contactPhone: ctx.brand.contactPhone,
      homeHref:
        navLinks.find((l) => /^home$/i.test(l.label))?.href ||
        navLinks[0]?.href,
      roomsHref,
      aboutHref: navLinks.find((l) => /about|story/i.test(l.label))?.href,
      contactHref: navLinks.find((l) => /contact/i.test(l.label))?.href,
      reserveHref: bookHref || roomsHref,
    };
    return (
      <SafariShell
        brandName={ctx.brand.name}
        nav={nav}
        bookHref={bookHref}
        previewPages={previewPages}
        analytics={ctx.analytics}
        interactive={!ctx.preview}
      >
        <SafariSectionList
          sections={sections}
          data={result?.data}
          asset={siteAsset}
          ctx={safariCtx}
        />
      </SafariShell>
    );
  }

  return (
    <SiteThemeRoot theme={ctx.theme}>
      <SiteChrome
        brand={ctx.brand}
        nav={ctx.nav}
        conversion={ctx.conversion}
        analytics={ctx.analytics}
        layout={ctx.layout}
        popupForm={ctx.popupForm}
        websiteId={ctx.websiteId}
        darkChrome={siteSurfaceIsDark(ctx.theme)}
        analyticsWebsiteId={ctx.preview ? undefined : ctx.websiteId}
        header={ctx.theme.header}
        footer={ctx.theme.footer}
        preview={
          ctx.preview
            ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
            : undefined
        }
        previewPages={previewPages}
      >
        <section className="mx-auto w-full max-w-5xl px-5 py-16 md:py-20">
          <h1
            style={{
              fontFamily: "var(--site-font-heading)",
              color: "var(--site-ink)",
            }}
            className="text-3xl font-bold tracking-tight md:text-4xl"
          >
            {ctx.blog.heading?.trim() || "Blog"}
          </h1>
          <p
            style={{ color: "var(--site-mute)" }}
            className="mt-2 text-base md:text-lg"
          >
            {ctx.blog.intro?.trim() || "News, stories and local guides"}
          </p>

          {posts.length === 0 ? (
            <p
              style={{ color: "var(--site-mute)" }}
              className="mt-12 text-center text-sm"
            >
              No posts yet. Check back soon.
            </p>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <article
                    style={{
                      background: "var(--site-surface)",
                      borderColor: "var(--site-line)",
                      borderRadius: "var(--site-radius)",
                    }}
                    className="flex h-full flex-col overflow-hidden border"
                  >
                    {post.coverUrl ? (
                      <SiteImg
                        src={siteAsset(post.coverUrl) ?? post.coverUrl}
                        alt={post.title}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        widths={[320, 480, 640, 768]}
                        className="aspect-[16/9] w-full object-cover"
                      />
                    ) : null}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-2 text-xs">
                        {post.featured ? (
                          <span
                            style={{
                              background: "var(--site-accent)",
                              color: "#fff",
                            }}
                            className="rounded px-1.5 py-0.5 font-medium"
                          >
                            Featured
                          </span>
                        ) : null}
                        {post.date ? (
                          <span style={{ color: "var(--site-mute)" }}>
                            {post.date}
                          </span>
                        ) : null}
                      </div>
                      <h2
                        style={{
                          fontFamily: "var(--site-font-heading)",
                          color: "var(--site-ink)",
                        }}
                        className="mt-2 text-lg font-semibold transition-opacity group-hover:opacity-80"
                      >
                        {post.title}
                      </h2>
                      {post.excerpt ? (
                        <p
                          style={{ color: "var(--site-mute)" }}
                          className="mt-1.5 line-clamp-3 text-sm leading-relaxed"
                        >
                          {post.excerpt}
                        </p>
                      ) : null}
                      {post.authorName ? (
                        <p
                          style={{ color: "var(--site-mute)" }}
                          className="mt-auto pt-4 text-xs"
                        >
                          By {post.authorName}
                        </p>
                      ) : null}
                    </div>
                  </article>
                </a>
              ))}
            </div>
          )}
        </section>
      </SiteChrome>
    </SiteThemeRoot>
  );
}
