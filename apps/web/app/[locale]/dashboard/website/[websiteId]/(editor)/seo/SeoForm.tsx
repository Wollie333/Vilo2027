"use client";

import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  File,
  Globe,
  ImagePlus,
  ListChecks,
  Loader2,
  Search,
  Share2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  saveSeoAction,
  type MediaItem,
} from "@/app/[locale]/dashboard/website/actions";
import { MediaLibrary } from "@/components/website/MediaLibrary";
import { websiteAssetUrl } from "@/lib/website/assets";

export type PageSeoRow = {
  id: string;
  name: string;
  kind: string;
  slug: string;
  hasTitle: boolean;
  hasDescription: boolean;
};

type SeoState = {
  title: string;
  description: string;
  ogImagePath: string;
  gscToken: string;
  robotsIndex: boolean;
  sitemapEnabled: boolean;
};

const TITLE_REC = 60;
const DESC_REC = 160;

function CharCount({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span className={over ? "cc warn" : "cc"}>
      {len} / {max}
    </span>
  );
}

export function SeoForm({
  websiteId,
  fallbackTitle,
  previewHost,
  pages,
  initial,
}: {
  websiteId: string;
  fallbackTitle: string;
  previewHost: string;
  pages: PageSeoRow[];
  initial: SeoState;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [state, setState] = useState<SeoState>(initial);
  const [saving, startSave] = useTransition();
  const [mediaOpen, setMediaOpen] = useState(false);

  const set = <K extends keyof SeoState>(key: K, value: SeoState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  function onSave() {
    startSave(async () => {
      const res = await saveSeoAction({ websiteId, ...state });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("seoSaved"));
      router.refresh();
    });
  }

  const previewTitle = state.title.trim() || fallbackTitle;
  const previewDesc = state.description.trim() || t("seoDescFallback");
  const ogUrl = websiteAssetUrl(state.ogImagePath);
  const goodPages = pages.filter((p) => p.hasTitle && p.hasDescription).length;

  return (
    <div className="vilo-cms wrap-set">
      <div className="mb-5">
        <h1
          className="font-display text-[20px] font-extrabold"
          style={{ color: "var(--ink)" }}
        >
          {t("seoHeading")}
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>
          {t("seoSub")}
        </p>
      </div>

      {/* SEARCH APPEARANCE */}
      <div className="sblock">
        <div className="sblock-h">
          <span className="si">
            <Search style={{ width: 19, height: 19 }} />
          </span>
          <div>
            <h2>{t("seoSearchTitle")}</h2>
            <p>{t("seoSearchSub")}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="setrow col">
            <div className="lblrow">
              <label>{t("seoTitleLabel")}</label>
              <CharCount len={state.title.length} max={TITLE_REC} />
            </div>
            <input
              className="field"
              value={state.title}
              placeholder={fallbackTitle}
              maxLength={70}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="setrow col">
            <div className="lblrow">
              <label>{t("seoDescLabel")}</label>
              <CharCount len={state.description.length} max={DESC_REC} />
            </div>
            <textarea
              className="field"
              value={state.description}
              maxLength={200}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="setrow col">
            <label
              className="mb-2 block text-[11.5px] font-semibold"
              style={{ color: "#3A5A4E" }}
            >
              {t("seoGooglePreview")}
            </label>
            <div className="gprev">
              <div className="gu">
                <span className="fav">
                  <Globe style={{ width: 11, height: 11, color: "#10B981" }} />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, color: "#202124" }}>
                    {fallbackTitle}
                  </div>
                  <div className="gp">{previewHost}</div>
                </div>
              </div>
              <div className="gt">{previewTitle}</div>
              <div className="gd">{previewDesc}</div>
            </div>
          </div>
        </div>
      </div>

      {/* SOCIAL SHARING */}
      <div className="sblock">
        <div className="sblock-h">
          <span className="si">
            <Share2 style={{ width: 19, height: 19 }} />
          </span>
          <div>
            <h2>{t("seoOgTitle")}</h2>
            <p>{t("seoOgSub")}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="setrow" style={{ alignItems: "stretch" }}>
            <div className="lbl" style={{ maxWidth: 360 }}>
              <b>{t("seoOgImage")}</b>
              <span>{t("seoOgHint")}</span>
              <div
                className="imgpick mt-3"
                onClick={() => setMediaOpen(true)}
                role="button"
                tabIndex={0}
              >
                {ogUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ogUrl} alt="" />
                ) : (
                  <ImagePlus style={{ width: 24, height: 24 }} />
                )}
                <div className="ip-ov">
                  <ImagePlus style={{ width: 16, height: 16 }} />
                  {t("seoOgReplace")}
                </div>
              </div>
            </div>
            <div
              className="ctl"
              style={{ alignItems: "stretch", flex: 1, minWidth: 0 }}
            >
              <div className="ogprev" style={{ width: "100%" }}>
                <div
                  className="ogimg"
                  style={
                    ogUrl ? { backgroundImage: `url(${ogUrl})` } : undefined
                  }
                >
                  {ogUrl ? null : <Globe style={{ width: 30, height: 30 }} />}
                </div>
                <div className="ogb">
                  <div className="ogu">{previewHost}</div>
                  <div className="ogt">{previewTitle}</div>
                  <div className="ogd">{previewDesc}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PER-PAGE SEO */}
      <div className="sblock">
        <div className="sblock-h">
          <span className="si">
            <ListChecks style={{ width: 19, height: 19 }} />
          </span>
          <div style={{ flex: 1 }}>
            <h2>{t("seoPagesTitle")}</h2>
            <p>{t("seoPagesSub", { good: goodPages, total: pages.length })}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="seorow head">
            <div className="smallcaps">{t("seoColPage")}</div>
            <div className="smallcaps">{t("seoColTitle")}</div>
            <div className="smallcaps">{t("seoColDescription")}</div>
            <div className="smallcaps">{t("seoColScore")}</div>
            <div />
          </div>
          <div className="p-2">
            {pages.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-[13px]"
                style={{ color: "var(--mute)" }}
              >
                {t("seoNoPages")}
              </div>
            ) : (
              pages.map((p) => {
                const score =
                  p.hasTitle && p.hasDescription
                    ? { key: "seoScoreGood", color: "#10B981" }
                    : p.hasTitle || p.hasDescription
                      ? { key: "seoScoreFair", color: "#F59E0B" }
                      : { key: "seoScoreMissing", color: "#EF4444" };
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/website/${websiteId}/pages/${p.id}`}
                    className="seorow"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex items-center justify-center"
                        style={{
                          height: 30,
                          width: 30,
                          borderRadius: 8,
                          background: "var(--soft)",
                          color: "#064E3B",
                          flexShrink: 0,
                        }}
                      >
                        <File style={{ width: 15, height: 15 }} />
                      </span>
                      <div className="min-w-0">
                        <div
                          className="truncate font-display text-[13.5px] font-bold"
                          style={{ color: "var(--ink)" }}
                        >
                          {p.name}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--mute)" }}
                        >
                          /{p.slug}
                        </div>
                      </div>
                    </div>
                    <div
                      className="checkpill"
                      style={{ color: p.hasTitle ? "#047857" : "#B45309" }}
                    >
                      {p.hasTitle ? (
                        <Check style={{ width: 13, height: 13 }} />
                      ) : (
                        <AlertTriangle style={{ width: 13, height: 13 }} />
                      )}
                      {t("seoColTitle")}
                    </div>
                    <div
                      className="checkpill"
                      style={{
                        color: p.hasDescription ? "#047857" : "#B45309",
                      }}
                    >
                      {p.hasDescription ? (
                        <Check style={{ width: 13, height: 13 }} />
                      ) : (
                        <AlertTriangle style={{ width: 13, height: 13 }} />
                      )}
                      {t("seoColDescription")}
                    </div>
                    <div className="score" style={{ color: score.color }}>
                      <span
                        className="sd"
                        style={{ background: score.color }}
                      />
                      {t(score.key)}
                    </div>
                    <ChevronRight
                      style={{
                        width: 16,
                        height: 16,
                        color: "#9DB4A8",
                        justifySelf: "end",
                      }}
                    />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* INDEXING */}
      <div className="sblock">
        <div className="sblock-h">
          <span className="si">
            <Bot style={{ width: 19, height: 19 }} />
          </span>
          <div>
            <h2>{t("seoIndexTitle")}</h2>
            <p>{t("seoIndexSub")}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="setrow">
            <div className="lbl">
              <b>{t("seoRobotsIndex")}</b>
              <span>{t("seoRobotsHint")}</span>
            </div>
            <div className="ctl">
              <button
                type="button"
                className={`sw${state.robotsIndex ? "on" : ""}`}
                aria-pressed={state.robotsIndex}
                onClick={() => set("robotsIndex", !state.robotsIndex)}
              />
            </div>
          </div>
          <div className="setrow">
            <div className="lbl">
              <b>{t("seoSitemap")}</b>
              <span className="mono">
                {previewHost}/sitemap.xml — {pages.length} URLs
              </span>
            </div>
            <div className="ctl">
              <span
                className={`tag ${state.sitemapEnabled ? "green" : "gray"}`}
              >
                <span className="d" />
                {state.sitemapEnabled ? t("seoSitemapOn") : t("seoSitemapOff")}
              </span>
              <button
                type="button"
                className={`sw${state.sitemapEnabled ? "on" : ""}`}
                aria-pressed={state.sitemapEnabled}
                onClick={() => set("sitemapEnabled", !state.sitemapEnabled)}
              />
            </div>
          </div>
          <div className="setrow col">
            <div className="lblrow">
              <label>{t("seoGscLabel")}</label>
            </div>
            <input
              className="field mono"
              value={state.gscToken}
              maxLength={120}
              placeholder="google-site-verification=…"
              onChange={(e) => set("gscToken", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2
              className="animate-spin"
              style={{ width: 16, height: 16 }}
            />
          ) : (
            <Check style={{ width: 16, height: 16 }} />
          )}
          {t("saveChanges")}
        </button>
      </div>

      <MediaLibrary
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        websiteId={websiteId}
        onSelectItem={(item: MediaItem) => set("ogImagePath", item.path)}
      />
    </div>
  );
}
