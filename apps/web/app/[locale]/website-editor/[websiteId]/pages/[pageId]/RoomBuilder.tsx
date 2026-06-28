"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { saveRoomDetailOverrideAction } from "@/app/[locale]/dashboard/website/actions";
import { SectionEditor } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/SectionEditor";
import { SectionLibrary } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/SectionLibrary";
import { newSection } from "@/lib/website/sectionDefaults";
import {
  isRoomScoped,
  type SectionType,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import { mergeRoomDetailSections } from "@/lib/website/roomDetailOverride";
import { SectionRenderer } from "@/components/site/SectionRenderer";
import { RoomBookingDock } from "@/components/site/RoomBookingDock";
import { RoomDockLayout } from "@/components/site/RoomDockLayout";
import { SafariShell } from "@/components/site/safari/SafariShell";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { buildSafariNav } from "@/lib/site/safariNav";
import { websiteAssetUrl } from "@/lib/website/assets";
import type { SiteData, SiteDataByType } from "@/lib/site/types";
import type { PageBuilderData } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/loadPageBuilder";

import type { RoomBuilderData } from "./loadRoomBuilder";

const assetUrl = (p: string | null | undefined) =>
  websiteAssetUrl(p) ?? undefined;

/** Build the preview data map for the canvas: room-scoped sections get THIS
 *  room's live detail; the rest pull from the per-type pool (mirrors the page
 *  builder's buildPreviewData). */
function buildRoomPreviewData(
  sections: WebsiteSection[],
  pool: Partial<SiteDataByType>,
  room: RoomBuilderData["room"],
): SiteData {
  const data: SiteData = {};
  for (const s of sections) {
    if (room && isRoomScoped(s.type)) {
      data[s.id] = { type: s.type, data: room } as SiteData[string];
      continue;
    }
    const slice = (pool as Record<string, unknown>)[s.type];
    if (slice) data[s.id] = { type: s.type, data: slice } as SiteData[string];
  }
  return data;
}

/**
 * Per-room editor — the host customizes ONE room on top of the shared room
 * template (model: one template + per-room override layer). Template sections are
 * read-only context with a per-room Hide toggle; the host adds their own "extra"
 * sections below. Saves to `website_rooms.detail_overrides`; the shared design
 * stays in the template builder (edits there propagate to every room).
 */
export function RoomBuilder({
  data,
  page,
}: {
  data: RoomBuilderData;
  page: PageBuilderData;
}) {
  const t = useTranslations("website");
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(data.override?.hidden ?? []),
  );
  const [extras, setExtras] = useState<WebsiteSection[]>(
    () => data.override?.extras ?? [],
  );
  const [order, setOrder] = useState<string[]>(
    () => data.override?.order ?? [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, startSave] = useTransition();

  const initial = useMemo(
    () =>
      JSON.stringify({
        hidden: [...new Set(data.override?.hidden ?? [])].sort(),
        extras: data.override?.extras ?? [],
        order: data.override?.order ?? [],
      }),
    [data.override],
  );
  const current = JSON.stringify({
    hidden: [...hidden].sort(),
    extras,
    order,
  });
  const dirty = current !== initial;

  const selected = extras.find((s) => s.id === selectedId) ?? null;

  // The live canvas = the template merged with this room's overrides (drop hidden
  // → append extras), with THIS room's data injected — exactly what the public
  // room page renders. Recomputes as the host toggles/adds/edits.
  const merged = useMemo(
    () =>
      mergeRoomDetailSections(data.templateSections, {
        hidden: [...hidden],
        replaced: {},
        extras,
        order,
      }),
    [data.templateSections, hidden, extras, order],
  );
  const previewData = useMemo(
    () => buildRoomPreviewData(merged, page.dataByType, data.room),
    [merged, page.dataByType, data.room],
  );
  const isSafari = data.themePreset === "safari";

  // Listing-style split: the gallery renders full-width up top, the rest in the
  // content column beside the sticky booking dock (mirrors the public room page).
  const galleryMerged = useMemo(
    () => merged.filter((s) => s.type === "room_gallery"),
    [merged],
  );
  const contentMerged = useMemo(
    () => merged.filter((s) => s.type !== "room_gallery"),
    [merged],
  );

  // Unified, reorderable editor list: every section (template + extras) in the
  // room's order. Template sections can be hidden; extras can be edited/removed;
  // any section can be moved. Ids missing from `order` keep their natural spot.
  const templateIds = useMemo(
    () => new Set(data.templateSections.map((s) => s.id)),
    [data.templateSections],
  );
  const orderedAll = useMemo(() => {
    const all = [...data.templateSections, ...extras];
    if (!order.length) return all;
    const byId = new Map(all.map((s) => [s.id, s] as const));
    const seen = new Set<string>();
    const out: WebsiteSection[] = [];
    for (const id of order) {
      const s = byId.get(id);
      if (s && !seen.has(id)) {
        out.push(s);
        seen.add(id);
      }
    }
    for (const s of all) if (!seen.has(s.id)) out.push(s);
    return out;
  }, [data.templateSections, extras, order]);

  // Scroll the canvas to a newly-added extra so the host sees it appear (extras
  // append after the template, which can be below the fold on a long room page).
  const canvasRef = useRef<HTMLDivElement>(null);
  const prevExtras = useRef(extras.length);
  useEffect(() => {
    if (extras.length > prevExtras.current && canvasRef.current) {
      canvasRef.current.scrollTo({
        top: canvasRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevExtras.current = extras.length;
  }, [extras.length]);

  function toggleHidden(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSection(type: SectionType) {
    const section = newSection(type);
    setExtras((prev) => [...prev, section]);
    // Keep an explicit order in sync so the new extra has a tracked position.
    setOrder((prev) => (prev.length ? [...prev, section.id] : prev));
    setSelectedId(section.id);
    setLibraryOpen(false);
  }

  function updateExtra(next: WebsiteSection) {
    setExtras((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  }

  function removeExtra(id: string) {
    setExtras((prev) => prev.filter((s) => s.id !== id));
    setOrder((prev) => prev.filter((x) => x !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // Move ANY section (template or extra) up/down. Snapshots the current visual
  // order into an explicit id list, swaps, and stores it as the per-room order.
  function moveSection(id: string, dir: -1 | 1) {
    const ids = orderedAll.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setOrder(ids);
  }

  function onSave() {
    startSave(async () => {
      const res = await saveRoomDetailOverrideAction({
        websiteId: data.websiteId,
        roomId: data.roomId,
        override: { hidden: [...hidden], replaced: {}, extras, order },
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("roomEditSaved"));
    });
  }

  const templateHref = `/website-editor/${data.websiteId}/pages/${data.pageId}`;
  const previewHref = data.roomSlug
    ? `/site/rooms/${data.roomSlug}?site=${data.subdomain}&preview=1`
    : null;

  return (
    <div
      className="vilo-builder"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="etop">
        <Link
          href="/dashboard/website"
          className="btn btn-ghost btn-sm"
          aria-label={t("back")}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
        </Link>
        <div style={{ minWidth: 0 }}>
          <div
            className="truncate font-display text-[15px] font-bold"
            style={{ color: "var(--ink)" }}
          >
            {t("roomEditCustomize", { room: data.roomName })}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--mute)" }}>
            {t("roomEditThisRoomOnly")}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href={templateHref} className="btn btn-ghost btn-sm">
            {t("roomEditTemplate")}
          </Link>
          {previewHref ? (
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
              {t("roomEditPreview")}
            </a>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={saving || !dirty}
          >
            {saving ? (
              <Loader2
                className="animate-spin"
                style={{ width: 14, height: 14 }}
              />
            ) : (
              <Check style={{ width: 14, height: 14 }} />
            )}
            {t("save")}
          </button>
        </div>
      </div>

      <div className="ebody">
        <aside className="epanel l">
          <div className="epanel-h">
            <h3>{t("roomEditSectionsTitle")}</h3>
          </div>
          <div className="epanel-b">
            <div className="insp-sec">
              <div className="isec-t">{t("roomEditSectionsTitle")}</div>
              <p className="text-[11.5px]" style={{ color: "var(--mute)" }}>
                {t("roomEditReorderHint")}
              </p>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {orderedAll.map((s, i) => {
                  const isTemplate = templateIds.has(s.id);
                  const isHidden = hidden.has(s.id);
                  const isSelected = selectedId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-1 rounded-[10px] border px-2 py-1.5 ${
                        isSelected
                          ? "border-brand-primary"
                          : "border-brand-line"
                      } bg-white`}
                      style={{ opacity: isHidden ? 0.55 : 1 }}
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveSection(s.id, -1)}
                          className="rounded p-0.5 text-brand-mute hover:bg-brand-light disabled:opacity-30"
                          aria-label={t("moveUp")}
                        >
                          <ArrowUp style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          type="button"
                          disabled={i === orderedAll.length - 1}
                          onClick={() => moveSection(s.id, 1)}
                          className="rounded p-0.5 text-brand-mute hover:bg-brand-light disabled:opacity-30"
                          aria-label={t("moveDown")}
                        >
                          <ArrowDown style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                      {isTemplate ? (
                        <span className="flex min-w-0 flex-1 items-center">
                          <span
                            className="truncate text-[12.5px] font-medium"
                            style={{
                              color: "var(--ink)",
                              textDecoration: isHidden
                                ? "line-through"
                                : "none",
                            }}
                          >
                            {t(`sectionType_${s.type}`)}
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          <Pencil
                            style={{
                              width: 12,
                              height: 12,
                              color: "var(--mute)",
                            }}
                          />
                          <span
                            className="truncate text-[12.5px] font-medium"
                            style={{ color: "var(--ink)" }}
                          >
                            {t(`sectionType_${s.type}`)}
                          </span>
                        </button>
                      )}
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={
                          isTemplate
                            ? {
                                background: "var(--line)",
                                color: "var(--mute)",
                              }
                            : {
                                background: "rgba(16,185,129,.14)",
                                color: "#0f7a57",
                              }
                        }
                      >
                        {isTemplate
                          ? t("roomEditTagTemplate")
                          : t("roomEditTagCustom")}
                      </span>
                      {isTemplate ? (
                        <button
                          type="button"
                          onClick={() => toggleHidden(s.id)}
                          className="rounded p-1 text-brand-mute hover:bg-brand-light"
                          aria-label={
                            isHidden ? t("roomEditShow") : t("roomEditHide")
                          }
                          title={
                            isHidden ? t("roomEditShow") : t("roomEditHide")
                          }
                        >
                          {isHidden ? (
                            <EyeOff style={{ width: 14, height: 14 }} />
                          ) : (
                            <Eye style={{ width: 14, height: 14 }} />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeExtra(s.id)}
                          className="rounded p-1 text-brand-mute hover:text-red-600"
                          aria-label={t("removeItem")}
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10, width: "100%" }}
                onClick={() => setLibraryOpen(true)}
              >
                <Plus style={{ width: 14, height: 14 }} />
                {t("roomEditAddSection")}
              </button>
            </div>
          </div>
        </aside>

        {/* Live canvas — the room rendered exactly as the public page will, with
            this room's real data + the host's per-room overrides applied. */}
        <div className="canvas-wrap" ref={canvasRef}>
          <div className="device">
            {isSafari ? (
              <SafariShell
                brandName={page.brand.name}
                nav={buildSafariNav({
                  nav: page.nav,
                  navigation: page.navConfig,
                  brand: page.brand,
                  preview: false,
                  subdomain: "",
                })}
                bookHref={data.room?.bookHref ?? undefined}
                solidNav
              >
                <RoomDockLayout
                  gallery={
                    <SectionRenderer
                      sections={galleryMerged}
                      data={previewData}
                      asset={assetUrl}
                      themeVariant="safari"
                      interactive={false}
                      errorLabel={t("sectionRenderError")}
                    />
                  }
                  dock={
                    <RoomBookingDock
                      roomName={data.roomName}
                      price={data.room?.price}
                      currency={data.room?.currency}
                      bookHref={data.room?.bookHref ?? "#"}
                      interactive={false}
                    />
                  }
                >
                  <SectionRenderer
                    sections={contentMerged}
                    data={previewData}
                    asset={assetUrl}
                    themeVariant="safari"
                    interactive={false}
                    errorLabel={t("sectionRenderError")}
                  />
                </RoomDockLayout>
              </SafariShell>
            ) : (
              <SiteThemeRoot theme={page.theme}>
                <SiteChrome
                  brand={page.brand}
                  nav={page.nav}
                  navigation={page.navConfig}
                  header={page.theme.header}
                  footer={page.theme.footer}
                  layout={page.layout}
                  bookHref={data.room?.bookHref ?? undefined}
                  chromeInert
                >
                  <RoomDockLayout
                    gallery={
                      <SectionRenderer
                        sections={galleryMerged}
                        data={previewData}
                        asset={assetUrl}
                        themeVariant={data.themePreset}
                        interactive={false}
                        errorLabel={t("sectionRenderError")}
                      />
                    }
                    dock={
                      <RoomBookingDock
                        roomName={data.roomName}
                        price={data.room?.price}
                        currency={data.room?.currency}
                        bookHref={data.room?.bookHref ?? "#"}
                        interactive={false}
                      />
                    }
                  >
                    <SectionRenderer
                      sections={contentMerged}
                      data={previewData}
                      asset={assetUrl}
                      themeVariant={data.themePreset}
                      interactive={false}
                      errorLabel={t("sectionRenderError")}
                    />
                  </RoomDockLayout>
                </SiteChrome>
              </SiteThemeRoot>
            )}
          </div>
        </div>

        <main className="epanel r">
          <div className="epanel-h">
            <SlidersHorizontal
              style={{ width: 16, height: 16, color: "#10B981" }}
            />
            <h3>
              {selected ? t(`sectionType_${selected.type}`) : t("pbInspector")}
            </h3>
          </div>
          <div className="epanel-b thin">
            {selected ? (
              <SectionEditor
                websiteId={data.websiteId}
                section={selected}
                onChange={updateExtra}
                themePreset={data.themePreset}
              />
            ) : (
              <div
                className="insp-sec text-center text-[13px]"
                style={{ color: "var(--mute)" }}
              >
                {t("roomEditInspectorHint")}
              </div>
            )}
          </div>
        </main>
      </div>

      <SectionLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={addSection}
      />
    </div>
  );
}
