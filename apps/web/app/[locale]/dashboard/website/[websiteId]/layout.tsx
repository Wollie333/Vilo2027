import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { hostHasFeature } from "@/lib/products/featureGate";

import { loadWebsiteEditorData } from "./loadWebsiteEditorData";
import { WebsiteLocked } from "../_components/WebsiteLocked";

export const dynamic = "force-dynamic";

/**
 * Root layout for website editor routes. Handles auth and feature gating only.
 * The tabbed UI (header + tabs) is in the (editor) route group layout.
 * Brand Studio sits outside (editor) so it doesn't get the tabs.
 */
export default async function WebsiteEditorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const data = await loadWebsiteEditorData(websiteId);
  if (!data) notFound();

  // W15 — protect deep links into the editor: a host whose plan no longer
  // grants the builder sees the upgrade card, not the (gated, write-locked) tabs.
  if (!(await hostHasFeature(data.hostId, "website_builder"))) {
    return <WebsiteLocked />;
  }

  return <>{children}</>;
}
