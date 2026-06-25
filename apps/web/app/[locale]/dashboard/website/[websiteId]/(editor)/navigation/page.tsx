import { Menu, PanelBottom, PanelTop, Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import { ensureDefaultMenu } from "@/lib/website/defaultMenu";
import { navigationSchema } from "@/app/[locale]/dashboard/website/schemas";

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

  // First-time hosts get a real, editable default menu (derived from their pages)
  // instead of the implicit "auto-pull every page" fallback.
  const navigation = await ensureDefaultMenu(
    supabase,
    websiteId,
    navigationSchema.parse(site.navigation ?? {}),
  );
  const brandName =
    ((site.brand ?? {}) as { name?: string }).name?.trim() || site.subdomain;

  const menuCount = navigation.menu?.length ?? 0;
  const colCount = navigation.footer.columns?.length ?? 0;
  const editBase = `/website-editor/${websiteId}/navigation`;

  return (
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
          <Link href={`${editBase}/header`} className="btn btn-primary btn-sm">
            <Pencil style={{ width: 14, height: 14 }} />
            {t("navEditHeader")}
          </Link>
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
          <Link href={`${editBase}/menu`} className="btn btn-primary btn-sm">
            <Pencil style={{ width: 14, height: 14 }} />
            {t("navEditMenu")}
          </Link>
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
          <Link href={`${editBase}/footer`} className="btn btn-primary btn-sm">
            <Pencil style={{ width: 14, height: 14 }} />
            {t("navEditFooter")}
          </Link>
        </div>
        <div className="nv-mod-prev">
          <div className="nv-mod-prevwrap" style={{ border: 0 }}>
            <NavFooterPreview nav={navigation} brandName={brandName} />
          </div>
        </div>
      </div>
    </div>
  );
}
