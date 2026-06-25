import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SiteRoomView } from "@/components/site/SiteRoomView";
import { resolveSiteRef } from "@/lib/site/loadSitePage";
import { siteMetadata } from "@/lib/site/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ roomSlug: string }>;
  searchParams: Promise<{ site?: string; preview?: string }>;
}): Promise<Metadata> {
  const { roomSlug } = await params;
  const sp = await searchParams;
  const h = await headers();
  return siteMetadata({
    host: h.get("x-vilo-site-host"),
    siteParam: sp?.site,
    roomSlug,
    preview: sp?.preview === "1",
  });
}

// Individual room detail page (/rooms/<slug>) — the room card links here. Renders
// the website's room-detail template (or the theme default) for the matched room.
export default async function SiteRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomSlug: string }>;
  searchParams: Promise<{ site?: string; preview?: string; theme?: string }>;
}) {
  const { roomSlug } = await params;
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-vilo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();

  return (
    <SiteRoomView
      siteRef={ref}
      roomSlug={roomSlug}
      preview={sp?.preview === "1"}
      siteParam={sp?.site}
      themeSlug={sp?.theme}
    />
  );
}
