import { notFound } from "next/navigation";

import { listWebsiteMediaAction } from "@/app/[locale]/dashboard/website/actions";

import { loadRoomGalleries } from "./loadMedia";
import { MediaManager } from "./MediaManager";

export const dynamic = "force-dynamic";

export default async function WebsiteMediaPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [mediaRes, rooms] = await Promise.all([
    listWebsiteMediaAction(websiteId),
    loadRoomGalleries(websiteId),
  ]);
  if (rooms === null) notFound();

  return (
    <MediaManager
      websiteId={websiteId}
      initialMedia={mediaRes.ok ? mediaRes.items : []}
      initialRooms={rooms}
    />
  );
}
