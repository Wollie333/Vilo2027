import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { BlogPreviewData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "blog_preview" }>["props"];

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

  return (
    <SectionShell surface>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      {posts.length === 0 ? (
        <Muted className="text-center text-sm">
          Your latest blog posts appear here.
        </Muted>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <a key={post.href} href={post.href} className="group block">
                <Card className="flex h-full flex-col">
                  {post.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.coverUrl}
                      alt={post.title}
                      loading="lazy"
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col p-5">
                    {post.date ? (
                      <span
                        style={{ color: "var(--site-mute)" }}
                        className="text-xs"
                      >
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
                </Card>
              </a>
            ))}
          </div>
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
    </SectionShell>
  );
}
