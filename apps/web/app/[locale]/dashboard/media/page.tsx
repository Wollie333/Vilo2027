import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadHostMedia } from "./loadHostMedia";
import { HostMediaManager } from "./HostMediaManager";

export const metadata: Metadata = { title: "Media" };
export const dynamic = "force-dynamic";

export default async function HostMediaPage() {
  const data = await loadHostMedia();
  if (!data) notFound();
  return <HostMediaManager data={data} />;
}
