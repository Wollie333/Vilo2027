import { notFound } from "next/navigation";

import { PostEditor } from "./PostEditor";
import { loadBlogPost } from "./loadBlogPost";

export const dynamic = "force-dynamic";

export default async function FullScreenBlogPostPage({
  params,
}: {
  params: Promise<{ websiteId: string; postId: string }>;
}) {
  const { websiteId, postId } = await params;
  const data = await loadBlogPost(websiteId, postId);
  if (!data) notFound();

  return (
    <PostEditor
      websiteId={websiteId}
      subdomain={data.subdomain}
      categories={data.categories}
      authors={data.authors}
      allTags={data.allTags}
      initialPost={data.post}
      themeVars={data.themeVars}
    />
  );
}
