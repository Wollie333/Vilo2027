import { notFound } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { loadPagesList, loadRoomChildren } from "./loadPagesList";
import { PagesManager } from "./PagesManager";

export const dynamic = "force-dynamic";

export default async function WebsitePagesList({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const supabase = createServerClient();
  const [pages, rooms, siteRes] = await Promise.all([
    loadPagesList(websiteId),
    loadRoomChildren(websiteId),
    supabase
      .from("host_websites")
      .select("subdomain")
      .eq("id", websiteId)
      .maybeSingle(),
  ]);
  if (!pages) notFound();

  const subdomain = `${siteRes.data?.subdomain ?? ""}.${
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || "vilo.site"
  }`;

  return (
    <PagesManager
      websiteId={websiteId}
      subdomain={subdomain}
      initialPages={pages}
      rooms={rooms}
    />
  );
}
