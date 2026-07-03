import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { BlogPreviewData } from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
// Bare element (Elementor reframe): renders bare (incl. the old `surface` band); the
// SECTION owns padding + width + background (re-seed the band as the section `bg`)
// and the heading is a separate Heading element above. `props.heading` stays legacy.
import { SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "blog_preview" }>["props"];
type PostItem = NonNullable<BlogPreviewData["posts"]>[number];

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
        <span style={{ color: "var(--site-mute)" }} className="text-xs">
          {post.date}
        </span>
      ) : null}
      <h3
        style={{
          fontFamily: "var(--site-font-heading)",
          color: "var(--site-ink)",
        }}
        className="mt-1 text-lg font-semibold transition-opacity group-hover:opacity-80"
      >
        {post.title}
      </h3>
      {post.excerpt ? (
        <p
          style={{ color: "var(--site-mute)" }}
          className="mt-1.5 line-clamp-3 text-sm leading-relaxed"
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
                  <Card className="flex flex-col sm:flex-row">
                    {post.coverUrl ? (
                      <SiteImg
                        src={post.coverUrl}
                        alt={post.title}
                        sizes="(min-width: 640px) 224px, 100vw"
                        widths={[320, 480, 640]}
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
                  <Card className="flex h-full flex-col">
                    {post.coverUrl ? (
                      <SiteImg
                        src={post.coverUrl}
                        alt={post.title}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        widths={[320, 480, 640, 768]}
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
