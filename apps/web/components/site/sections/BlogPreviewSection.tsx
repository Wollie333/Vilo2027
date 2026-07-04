import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { BlogPreviewData } from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
// Bare element (Elementor reframe): renders bare (incl. the old `surface` band); the
// SECTION owns padding + width + background (re-seed the band as the section `bg`)
// and the heading is a separate Heading element above. `props.heading` stays legacy.
import { SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "blog_preview" }>["props"];
type PostItem = NonNullable<BlogPreviewData["posts"]>[number];

// Per-element style hooks (Elementor accordion) — each reads `--el-<key>-*`.
const blogCardStyle = {
  background: "var(--el-card-bg, var(--site-surface))",
  border: "var(--el-card-bd, var(--site-card-border))",
  borderRadius: "var(--el-card-radius, var(--site-card-radius))",
  boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
} as const;

function PostMeta({
  post,
  className = "",
}: {
  post: PostItem;
  className?: string;
}) {
  return (
    <div className={className}>
      {post.date ? (
        <span
          style={{ color: "var(--el-meta-fg, var(--site-mute))" }}
          className="text-xs"
        >
          {post.date}
        </span>
      ) : null}
      <h3
        style={{
          fontFamily: "var(--site-font-heading)",
          color: "var(--el-title-fg, var(--site-ink))",
          fontSize: "var(--el-title-size, 1.125rem)",
          fontWeight: "var(--el-title-weight, 600)",
        }}
        className="mt-1 transition-opacity group-hover:opacity-80"
      >
        {post.title}
      </h3>
      {post.excerpt ? (
        <p
          style={{
            color: "var(--el-excerpt-fg, var(--site-mute))",
            fontSize: "var(--el-excerpt-size, 0.875rem)",
          }}
          className="mt-1.5 line-clamp-3 leading-relaxed"
        >
          {post.excerpt}
        </p>
      ) : null}
    </div>
  );
}

export function BlogPreviewSection({
  props,
  data,
}: {
  props: Props;
  data?: BlogPreviewData;
}) {
  const allPosts = data?.posts ?? [];
  const posts = allPosts.slice(0, props.max);
  const hasMore = allPosts.length > posts.length;
  const variant = props.variant ?? "grid";

  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      {posts.length === 0 ? (
        <Muted className="text-center text-sm">
          Your latest blog posts appear here.
        </Muted>
      ) : props.display === "journal" ? (
        // JOURNAL — a large featured first post over a grid of the rest (the
        // designed Journal index). One block, so posts never duplicate across two
        // sections. Reusable by any theme via the node `variant:"journal"`.
        <>
          <a
            href={posts[0].href}
            className="site-blog-feat group grid items-center gap-8 md:grid-cols-2 md:gap-12"
          >
            {posts[0].coverUrl ? (
              <SiteImg
                src={posts[0].coverUrl}
                alt={posts[0].title}
                sizes="(min-width: 768px) 50vw, 100vw"
                widths={[640, 768, 1024, 1280]}
                style={{ borderRadius: "var(--site-img-radius)" }}
                className="site-blog-feat-img aspect-[16/10] w-full object-cover"
              />
            ) : null}
            <div>
              {posts[0].date ? (
                <span
                  style={{ color: "var(--site-secondary)" }}
                  className="text-xs font-bold uppercase tracking-[0.14em]"
                >
                  Featured · {posts[0].date}
                </span>
              ) : null}
              <h3
                style={{
                  fontFamily: "var(--site-font-heading)",
                  fontWeight: "var(--site-weight-heading)" as unknown as number,
                  fontSize: "clamp(1.8rem, 4vw, 3rem)",
                  lineHeight: 1.02,
                  color: "var(--site-ink)",
                }}
                className="mt-3 transition-opacity group-hover:opacity-80"
              >
                {posts[0].title}
              </h3>
              {posts[0].excerpt ? (
                <p
                  style={{ color: "var(--site-mute)" }}
                  className="mt-4 max-w-[52ch] text-lg leading-relaxed"
                >
                  {posts[0].excerpt}
                </p>
              ) : null}
              <span
                style={{ color: "var(--site-accent)" }}
                className="mt-5 inline-flex text-sm font-semibold"
              >
                Read the story &rarr;
              </span>
            </div>
          </a>
          {posts.length > 1 ? (
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(1).map((post) => (
                <a key={post.href} href={post.href} className="group block">
                  <Card className="flex h-full flex-col" style={blogCardStyle}>
                    {post.coverUrl ? (
                      <SiteImg
                        src={post.coverUrl}
                        alt={post.title}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        widths={[320, 480, 640, 768]}
                        style={{ borderRadius: "var(--el-image-radius, 0px)" }}
                        className="aspect-[16/9] w-full object-cover"
                      />
                    ) : null}
                    <PostMeta
                      post={post}
                      className="flex flex-1 flex-col p-5"
                    />
                  </Card>
                </a>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          {variant === "compact" ? (
            <div className="mx-auto max-w-2xl">
              {posts.map((post) => (
                <a
                  key={post.href}
                  href={post.href}
                  className="group block border-t py-5 first:border-t-0"
                  style={{ borderColor: "var(--site-line)" }}
                >
                  <PostMeta post={post} />
                </a>
              ))}
            </div>
          ) : variant === "list" ? (
            <div className="mx-auto grid max-w-3xl gap-5">
              {posts.map((post) => (
                <a key={post.href} href={post.href} className="group block">
                  <Card
                    className="flex flex-col sm:flex-row"
                    style={blogCardStyle}
                  >
                    {post.coverUrl ? (
                      <SiteImg
                        src={post.coverUrl}
                        alt={post.title}
                        sizes="(min-width: 640px) 224px, 100vw"
                        widths={[320, 480, 640]}
                        style={{ borderRadius: "var(--el-image-radius, 0px)" }}
                        className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:w-56"
                      />
                    ) : null}
                    <PostMeta post={post} className="flex-1 p-5" />
                  </Card>
                </a>
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <a key={post.href} href={post.href} className="group block">
                  <Card className="flex h-full flex-col" style={blogCardStyle}>
                    {post.coverUrl ? (
                      <SiteImg
                        src={post.coverUrl}
                        alt={post.title}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        widths={[320, 480, 640, 768]}
                        style={{ borderRadius: "var(--el-image-radius, 0px)" }}
                        className="aspect-[16/9] w-full object-cover"
                      />
                    ) : null}
                    <PostMeta
                      post={post}
                      className="flex flex-1 flex-col p-5"
                    />
                  </Card>
                </a>
              ))}
            </div>
          )}
          {hasMore ? (
            <div className="mt-8 text-center">
              <a
                href="/blog"
                style={{ color: "var(--site-accent)" }}
                className="text-sm font-medium hover:underline"
              >
                View all posts &rarr;
              </a>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
