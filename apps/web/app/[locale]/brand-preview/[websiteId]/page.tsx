import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadBrandPreview } from "@/lib/site/loadBrandPreview";

import { BrandPreviewCanvas } from "../BrandPreviewCanvas";

// Owner-scoped internal preview surface for the Brand Studio iframe — renders
// the host's real site (preview mode), never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BrandPreviewPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const preview = await loadBrandPreview(websiteId);
  if (!preview) notFound();

  return <BrandPreviewCanvas preview={preview} />;
}
