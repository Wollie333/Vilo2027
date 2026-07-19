import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/site/JsonLd";
import { FirePixelEvent } from "@/components/site/FirePixelEvent";
import { PageHeadCode } from "@/components/site/PageHeadCode";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteImg } from "@/components/site/SiteImg";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { OceansViewArticle } from "@/components/site/oceansview/OceansViewArticle";
import { MarmaladeArticle } from "@/components/site/marmalade/MarmaladeArticle";
import { SabelaArticle } from "@/components/site/sabela/SabelaArticle";
import { siteAsset } from "@/components/site/SitePageView";
import {
  buildSitePreviewPages,
  loadRelatedPosts,
  loadSiteBlogPost,
  loadSiteContext,
  resolveSiteRef,
} from "@/lib/site/loadSitePage";
import { siteMetadata } from "@/lib/site/metadata";
import { buildBlogPostJsonLd } from "@/lib/site/structuredData";
import { siteSurfaceIsDark } from "@/lib/site/themes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ postSlug: string }>;
  searchParams: Promise<{ site?: string; preview?: string }>;
}): Promise<Metadata> {
  const { postSlug } = await params;
  const sp = await searchParams;
  const h = await headers();
  return siteMetadata({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
    postSlug,
    preview: sp?.preview === "1",
  });
}

export default async function SiteBlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ postSlug: string }>;
  searchParams: Promise<{ site?: string; preview?: string; theme?: string }>;
}) {
  const { postSlug } = await params;
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

  const [post, relatedPosts] = await Promise.all([
    loadSiteBlogPost(ctx, postSlug),
    loadRelatedPosts(ctx, postSlug),
  ]);
  if (!post) notFound();

  const cover = siteAsset(post.coverUrl);

  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;

  // Per-post marketing overrides (Blog editor → SEO): fire the post's pixel event
  // + inject its custom head code on the LIVE post page only (parity with pages,
  // see SitePageView). Skipped in preview so editor previews don't fire tracking.
  const postPixelEvent =
    !ctx.preview && post.pixelEvent && post.pixelEvent !== "none"
      ? post.pixelEvent
      : "";
  const postHeadCode = !ctx.preview ? post.headCode : "";
  const consentRequired = ctx.analytics?.cookieConsent?.enabled !== false;
  const marketing = (
    <>
      {postPixelEvent ? (
        <FirePixelEvent
          event={postPixelEvent}
          consentRequired={consentRequired}
        />
      ) : null}
      {postHeadCode ? (
        <PageHeadCode html={postHeadCode} consentRequired={consentRequired} />
      ) : null}
    </>
  );

  // Structured data (BlogPosting) — public render only.
  let jsonLdGraph: Record<string, unknown>[] = [];
  if (!ctx.preview) {
    const host = h.get("x-wielo-site-host") || h.get("host") || "";
    if (host) {
      const scheme =
        host.startsWith("localhost") || host.startsWith("127.")
          ? "http"
          : "https";
      jsonLdGraph = buildBlogPostJsonLd({
        ctx,
        post: {
          title: post.title,
          date: post.date,
          authorName: post.authorName,
          coverUrl: cover ?? null,
          excerpt: post.excerpt,
        },
        postSlug,
        origin: `${scheme}://${host}`,
      });
    }
  }

  return (
    <>
      {marketing}
      <JsonLd graph={jsonLdGraph} />
      <SiteThemeRoot theme={ctx.theme}>
        <SiteChrome
          brand={ctx.brand}
          nav={ctx.nav}
          navigation={ctx.navigation}
          conversion={ctx.conversion}
          analytics={ctx.analytics}
          layout={ctx.layout}
          popupForm={ctx.popupForm}
          websiteId={ctx.websiteId}
          darkChrome={siteSurfaceIsDark(ctx.theme)}
          analyticsWebsiteId={ctx.preview ? undefined : ctx.websiteId}
          preset={ctx.theme.preset}
          header={ctx.theme.header}
          footer={ctx.theme.footer}
          preview={
            ctx.preview
              ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
              : undefined
          }
          previewPages={previewPages}
          pageHasHero={
            ctx.theme.preset === "oceansview" ||
            ctx.theme.preset === "safari" ||
            ctx.theme.preset === "marmalade"
          }
        >
          {ctx.theme.preset === "oceansview" ||
          ctx.theme.preset === "safari" ? (
            <OceansViewArticle
              brandName={ctx.brand.name}
              post={post}
              related={relatedPosts}
              socials={ctx.brand.socials}
              asset={siteAsset}
            />
          ) : ctx.theme.preset === "marmalade" ? (
            <MarmaladeArticle
              brandName={ctx.brand.name}
              post={post}
              related={relatedPosts}
              socials={ctx.brand.socials}
              asset={siteAsset}
            />
          ) : ctx.theme.preset === "hotel" ? (
            <SabelaArticle
              brandName={ctx.brand.name}
              post={post}
              related={relatedPosts}
              socials={ctx.brand.socials}
              asset={siteAsset}
            />
          ) : (
            <article className="mx-auto w-full max-w-2xl px-5 py-16 md:py-20">
              <a
                href="/"
                style={{ color: "var(--site-accent)" }}
                className="text-sm font-medium hover:opacity-80"
              >
                ← {ctx.brand.name}
              </a>
              <h1
                style={{
                  fontFamily: "var(--site-font-heading)",
                  color: "var(--site-ink)",
                }}
                className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl"
              >
                {post.title}
              </h1>
              <div
                style={{ color: "var(--site-mute)" }}
                className="mt-2 flex items-center gap-2 text-sm"
              >
                {post.authorName ? <span>{post.authorName}</span> : null}
                {post.authorName && post.date ? <span>·</span> : null}
                {post.date ? <span>{post.date}</span> : null}
              </div>
              {cover ? (
                <SiteImg
                  src={cover}
                  alt={post.title}
                  priority
                  sizes="(min-width: 768px) 768px, 100vw"
                  widths={[480, 768, 1024, 1280]}
                  style={{ borderRadius: "var(--site-radius)" }}
                  className="mt-6 aspect-[16/9] w-full object-cover"
                />
              ) : null}
              <div
                style={{ color: "var(--site-ink)" }}
                className="site-prose mt-8 space-y-4 text-base leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-4 [&_img]:rounded [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold"
                // body_html is sanitised in loadSiteBlogPost
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
              />

              {post.tags.length > 0 ? (
                <div className="mt-8 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <a
                      key={tag.slug}
                      href={`/blog/tag/${tag.slug}`}
                      style={{
                        background: "var(--site-surface)",
                        borderColor: "var(--site-line)",
                        color: "var(--site-mute)",
                        borderRadius: "var(--site-radius)",
                      }}
                      className="border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                    >
                      #{tag.name}
                    </a>
                  ))}
                </div>
              ) : null}

              {post.authorName && (post.authorBio || post.authorAvatarUrl) ? (
                <div
                  style={{
                    borderColor: "var(--site-line)",
                    background: "var(--site-surface)",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="mt-12 flex items-start gap-4 border p-5"
                >
                  {post.authorAvatarUrl ? (
                    <SiteImg
                      src={post.authorAvatarUrl}
                      alt={post.authorName}
                      sizes="56px"
                      widths={[56, 112]}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : null}
                  <div>
                    <p
                      style={{ color: "var(--site-ink)" }}
                      className="font-semibold"
                    >
                      {post.authorName}
                    </p>
                    {post.authorBio ? (
                      <p
                        style={{ color: "var(--site-mute)" }}
                        className="mt-1 text-sm leading-relaxed"
                      >
                        {post.authorBio}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {relatedPosts.length > 0 ? (
                <div className="mt-16">
                  <h2
                    style={{
                      fontFamily: "var(--site-font-heading)",
                      color: "var(--site-ink)",
                    }}
                    className="text-xl font-semibold"
                  >
                    Related posts
                  </h2>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {relatedPosts.map((related) => (
                      <a
                        key={related.slug}
                        href={`/blog/${related.slug}`}
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
                          {related.coverUrl ? (
                            <SiteImg
                              src={
                                siteAsset(related.coverUrl) ?? related.coverUrl
                              }
                              alt={related.title}
                              sizes="(min-width: 640px) 33vw, 100vw"
                              widths={[320, 480, 640]}
                              className="aspect-[16/9] w-full object-cover"
                            />
                          ) : null}
                          <div className="p-4">
                            <h3
                              style={{
                                fontFamily: "var(--site-font-heading)",
                                color: "var(--site-ink)",
                              }}
                              className="line-clamp-2 text-sm font-semibold transition-opacity group-hover:opacity-80"
                            >
                              {related.title}
                            </h3>
                          </div>
                        </article>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          )}
        </SiteChrome>
      </SiteThemeRoot>
    </>
  );
}
