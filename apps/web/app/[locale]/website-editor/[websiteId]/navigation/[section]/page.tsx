import { notFound } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import { pageHref } from "@/lib/site/loadSitePage";
import { createServerClient } from "@/lib/supabase/server";
import { navigationSchema } from "@/app/[locale]/dashboard/website/schemas";

import { NavSectionEditor } from "./NavSectionEditor";

export const dynamic = "force-dynamic";

const SECTIONS = ["header", "menu", "footer"] as const;
type Section = (typeof SECTIONS)[number];

export default async function NavigationSectionEditorPage({
  params,
}: {
  params: Promise<{ websiteId: string; section: string }>;
}) {
  const { websiteId, section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();

  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) notFound();

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain, navigation, brand")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) notFound();

  const navigation = navigationSchema.parse(site.navigation ?? {});
  const brandName =
    ((site.brand ?? {}) as { name?: string }).name?.trim() || site.subdomain;

  const { data: pageRows } = await supabase
    .from("website_pages")
    .select("kind, slug, nav_label, title, nav_order")
    .eq("website_id", websiteId)
    .order("nav_order", { ascending: true });
  const pages = (pageRows ?? []).map((p) => ({
    label: p.nav_label?.trim() || p.title?.trim() || p.slug,
    href: pageHref(p.kind, p.slug),
  }));

  return (
    <NavSectionEditor
      websiteId={websiteId}
      section={section as Section}
      initial={navigation}
      pages={pages}
      brandName={brandName}
      subdomain={site.subdomain}
    />
  );
}
