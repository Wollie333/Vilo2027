import { Menu, PanelBottom, PanelTop, Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyHostId } from "@/lib/host/current";
import { pageHref } from "@/lib/site/loadSitePage";
import { createServerClient } from "@/lib/supabase/server";
import { navigationSchema } from "@/app/[locale]/dashboard/website/schemas";

import { NavigationForm } from "./NavigationForm";
import {
  NavFooterPreview,
  NavHeaderPreview,
  NavMenuPills,
} from "./NavPreviews";

export const dynamic = "force-dynamic";

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="nv-pill" style={on ? undefined : { opacity: 0.5 }}>
      <span className="d" style={on ? undefined : { background: "#C7D4CD" }} />
      {label}
    </span>
  );
}

export default async function WebsiteNavigationPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const t = await getTranslations("website");

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

  const menuCount = navigation.menu?.length ?? 0;
  const colCount = navigation.footer.columns?.length ?? 0;

  return (
    <div>
      <div className="vilo-cms vilo-nav mx-auto max-w-[1080px] space-y-6">
        <div>
          <h1
            className="font-display text-[20px] font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {t("navHeading")}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>
            {t("navSub")}
          </p>
        </div>

        {/* HEADER */}
        <div className="nv-mod">
          <div className="nv-mod-h">
            <span className="mi">
              <PanelTop style={{ width: 19, height: 19 }} />
            </span>
            <div style={{ flex: 1 }}>
              <h3>{t("navHeaderTitle")}</h3>
              <p>{t("navHeaderModDesc")}</p>
            </div>
            <div className="mr-1 hidden items-center gap-2 lg:flex">
              <Chip on={navigation.header.sticky} label={t("navSticky")} />
              <Chip
                on={Boolean(navigation.header.ctaLabel?.trim())}
                label={t("navCtaShort")}
              />
              <Chip
                on={Boolean(navigation.topBar.enabled)}
                label={t("navTopBarShort")}
              />
            </div>
            <a href="#nav-edit" className="btn btn-primary btn-sm">
              <Pencil style={{ width: 14, height: 14 }} />
              {t("navEditHeader")}
            </a>
          </div>
          <div className="nv-mod-prev">
            <div className="nv-mod-prevwrap">
              <NavHeaderPreview nav={navigation} brandName={brandName} />
            </div>
          </div>
        </div>

        {/* MAIN MENU */}
        <div className="nv-mod">
          <div className="nv-mod-h">
            <span className="mi">
              <Menu style={{ width: 19, height: 19 }} />
            </span>
            <div style={{ flex: 1 }}>
              <h3>{t("navMenuTitle")}</h3>
              <p>{t("navMenuModDesc", { count: menuCount })}</p>
            </div>
            <a href="#nav-edit" className="btn btn-primary btn-sm">
              <Pencil style={{ width: 14, height: 14 }} />
              {t("navEditMenu")}
            </a>
          </div>
          <div className="nv-mod-prev">
            <div
              className="nv-mod-prevwrap"
              style={{
                padding: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 9,
                background: "#fff",
              }}
            >
              <NavMenuPills nav={navigation} />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="nv-mod">
          <div className="nv-mod-h">
            <span className="mi">
              <PanelBottom style={{ width: 19, height: 19 }} />
            </span>
            <div style={{ flex: 1 }}>
              <h3>{t("navFooterTitle")}</h3>
              <p>{t("navFooterModDesc", { count: colCount })}</p>
            </div>
            <a href="#nav-edit" className="btn btn-primary btn-sm">
              <Pencil style={{ width: 14, height: 14 }} />
              {t("navEditFooter")}
            </a>
          </div>
          <div className="nv-mod-prev">
            <div className="nv-mod-prevwrap" style={{ border: 0 }}>
              <NavFooterPreview nav={navigation} brandName={brandName} />
            </div>
          </div>
        </div>
      </div>

      {/* Editing (the existing builder, anchored from the cards above). */}
      <div id="nav-edit" className="mx-auto mt-10 max-w-[760px] scroll-mt-6">
        <h2 className="mb-4 font-display text-lg font-bold text-brand-ink">
          {t("navEditTitle")}
        </h2>
        <NavigationForm
          websiteId={websiteId}
          initial={navigation}
          pages={pages}
        />
      </div>
    </div>
  );
}
