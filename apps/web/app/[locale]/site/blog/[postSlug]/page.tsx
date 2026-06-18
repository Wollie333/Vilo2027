import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { siteAsset } from "@/components/site/SitePageView";
import {
  loadSiteBlogPost,
  loadSiteContext,
  resolveSiteRef,
} from "@/lib/site/loadSitePage";
import { siteMetadata } from "@/lib/site/metadata";

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
    host: h.get("x-vilo-site-host"),
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
  searchParams: Promise<{ site?: string; preview?: string }>;
}) {
  const { postSlug } = await params;
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-vilo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();

  const preview = sp?.preview === "1";
  const ctx = await loadSiteContext(ref, { preview });
  if (!ctx) notFound();

  const post = await loadSiteBlogPost(ctx, postSlug);
  if (!post) notFound();

  const cover = siteAsset(post.coverUrl);

  return (
    <SiteThemeRoot theme={ctx.theme}>
      <SiteChrome brand={ctx.brand} nav={ctx.nav}>
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={post.title}
              style={{ borderRadius: "var(--site-radius)" }}
              className="mt-6 aspect-[16/9] w-full object-cover"
            />
          ) : null}
          <div
            style={{ color: "var(--site-ink)" }}
            className="site-prose mt-8 space-y-4 text-base leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold"
            // body_html is sanitised in loadSiteBlogPost
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
          />
        </article>
      </SiteChrome>
    </SiteThemeRoot>
  );
}
