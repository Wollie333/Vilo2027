import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { hostHasFeature } from "@/lib/products/featureGate";
import { loadWebsiteEditorData } from "@/app/[locale]/dashboard/website/[websiteId]/loadWebsiteEditorData";
import { WebsiteLocked } from "@/app/[locale]/dashboard/website/_components/WebsiteLocked";

export const dynamic = "force-dynamic";

/**
 * Owner + feature gate for the full-screen editors (mirrors the dashboard
 * `[websiteId]/layout`). Renders no chrome — each editor page owns its
 * full-viewport `.wielo-builder` frame.
 */
export default async function FullScreenEditorWebsiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const data = await loadWebsiteEditorData(websiteId);
  if (!data) notFound();
  if (!(await hostHasFeature(data.hostId, "website_builder"))) {
    return <WebsiteLocked />;
  }
  return <>{children}</>;
}
