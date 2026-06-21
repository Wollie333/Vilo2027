import { notFound } from "next/navigation";

import { BlogManager } from "./BlogManager";
import { loadBlogEditor } from "./loadBlogEditor";

export const dynamic = "force-dynamic";

export default async function WebsiteBlogPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const data = await loadBlogEditor(websiteId);
  if (!data) notFound();

  return (
    <BlogManager
      websiteId={websiteId}
      initialPosts={data.posts}
      initialCategories={data.categories}
      initialAuthors={data.authors}
    />
  );
}
