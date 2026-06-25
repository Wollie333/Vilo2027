import { notFound } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import { pageHref } from "@/lib/site/loadSitePage";
import { createServerClient } from "@/lib/supabase/server";
import { ensureDefaultMenu } from "@/lib/website/defaultMenu";
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

  const navigation =
    section === "menu"
      ? await ensureDefaultMenu(
          supabase,
          websiteId,
          navigationSchema.parse(site.navigation ?? {}),
        )
      : navigationSchema.parse(site.navigation ?? {});
  const brandName =
    ((site.brand ?? {}) as { name?: string }).name?.trim() || site.subdomain;

  const [{ data: pageRows }, { data: roomRows }] = await Promise.all([
    supabase
      .from("website_pages")
      .select("kind, slug, nav_label, title, nav_order")
      .eq("website_id", websiteId)
      .order("nav_order", { ascending: true }),
    // Visible rooms + their own names — for the auto-rooms hide list in the
    // menu builder. (Labels use the room's name, not the website override.)
    supabase
      .from("website_rooms")
      .select(
        "room_id, sort_order, room:property_rooms!inner ( name, deleted_at )",
      )
      .eq("website_id", websiteId)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }),
  ]);
  const pages = (pageRows ?? []).map((p) => ({
    label: p.nav_label?.trim() || p.title?.trim() || p.slug,
    href: pageHref(p.kind, p.slug),
  }));
  const rooms = (roomRows ?? [])
    .map((r) => {
      const room = r.room as unknown as {
        name: string;
        deleted_at: string | null;
      } | null;
      return room && !room.deleted_at
        ? { roomId: r.room_id as string, name: room.name }
        : null;
    })
    .filter((x): x is { roomId: string; name: string } => x !== null);

  return (
    <NavSectionEditor
      websiteId={websiteId}
      section={section as Section}
      initial={navigation}
      pages={pages}
      rooms={rooms}
      brandName={brandName}
      subdomain={site.subdomain}
    />
  );
}
