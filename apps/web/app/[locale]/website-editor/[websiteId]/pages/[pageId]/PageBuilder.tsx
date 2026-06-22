"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  BedDouble,
  Blocks,
  Building2,
  CalendarDays,
  ClipboardList,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Heading,
  Heart,
  HelpCircle,
  Image as ImageIcon,
  Images,
  LayoutTemplate,
  ListChecks,
  Loader2,
  Mail,
  Map as MapIcon,
  MapPin,
  Minus,
  MousePointerClick,
  Monitor,
  MoveVertical,
  Newspaper,
  Palette,
  PanelBottom,
  PanelTop,
  Pilcrow,
  Plus,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  SquareMousePointer,
  Star,
  Table,
  Tablet,
  Tag,
  Trash2,
  Type as TypeIcon,
  User,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link, useRouter as useLocaleRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  publishWebsiteAction,
  saveDraftSectionsAction,
  saveNavigationAction,
} from "@/app/[locale]/dashboard/website/actions";
import type {
  NavigationConfig,
  SavedSection,
} from "@/app/[locale]/dashboard/website/schemas";
import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome, type ChromeTarget } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type {
  SiteBrand,
  SiteData,
  SiteDataByType,
  SiteNavItem,
  SiteNavigation,
} from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";
import { newSection } from "@/lib/website/sectionDefaults";
import {
  HERO_LAYOUTS,
  isAutoPopulate,
  sectionsSchema,
  type HeroLayout,
  type SectionType,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import { extractSectionsText } from "@/lib/website/seoAnalyzer";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import { SectionEditor } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/SectionEditor";
import { PageSeoCard } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/PageSeoCard";
import { A11yCard } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/A11yCard";
import { MenuBuilder } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/MenuBuilder";
import {
  FooterInspector,
  HeaderInspector,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/NavInspectors";
import type { NavPageOption } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/loadPageBuilder";

const asset = (p: string | null | undefined) => websiteAssetUrl(p) ?? undefined;

type Device = "desktop" | "tablet" | "phone";

// Palette catalogue — same grouping as the SectionLibrary modal.
const GROUPS: Array<{ key: string; types: SectionType[] }> = [
  // Hero gets its own preset group (the 7 layouts); catHero keeps intro.
  { key: "catHero", types: ["intro"] },
  {
    key: "catShowcase",
    types: [
      "gallery",
      "rooms_preview",
      "specials_preview",
      "pricing",
      "video",
      "logos",
      "blog_preview",
    ],
  },
  {
    key: "catTrust",
    types: [
      "highlights",
      "stats",
      "reviews",
      "trust",
      "values",
      "amenities",
      "host_bio",
    ],
  },
  {
    key: "catBooking",
    types: ["booking_search", "availability_calendar", "rate_table"],
  },
  { key: "catLocation", types: ["location", "map"] },
  { key: "catConvert", types: ["cta", "contact_form", "form"] },
  { key: "catMore", types: ["rich_text", "faq"] },
  {
    key: "catElements",
    types: [
      "columns",
      "el_heading",
      "el_text",
      "el_image",
      "el_button",
      "el_spacer",
      "el_divider",
    ],
  },
];

const ICONS: Record<SectionType, LucideIcon> = {
  hero: ImageIcon,
  intro: AlignLeft,
  highlights: Sparkles,
  stats: BarChart3,
  gallery: Images,
  logos: Building2,
  rooms_preview: BedDouble,
  location: MapPin,
  map: MapIcon,
  reviews: Star,
  cta: MousePointerClick,
  host_bio: User,
  values: Heart,
  blog_preview: Newspaper,
  rich_text: TypeIcon,
  faq: HelpCircle,
  contact_form: Mail,
  form: ClipboardList,
  specials_preview: Tag,
  amenities: ListChecks,
  pricing: BadgeDollarSign,
  video: Video,
  trust: ShieldCheck,
  booking_search: Search,
  availability_calendar: CalendarDays,
  rate_table: Table,
  el_heading: Heading,
  el_text: Pilcrow,
  el_image: ImageIcon,
  el_button: SquareMousePointer,
  el_spacer: MoveVertical,
  el_divider: Minus,
  columns: Columns3,
};

// Icons for the seven hero presets surfaced as pickable cards in the sidebar.
const HERO_ICONS: Record<HeroLayout, LucideIcon> = {
  spotlight: ImageIcon,
  split_right: Columns3,
  split_left: Columns3,
  fullscreen: Monitor,
  minimal: TypeIcon,
  boxed: LayoutTemplate,
  search: Search,
};

/** Build the by-id SiteData map for the live preview from the per-type pool. */
function buildPreviewData(
  sections: WebsiteSection[],
  pool: Partial<SiteDataByType>,
): SiteData {
  const data: SiteData = {};
  const keys: SectionType[] = [
    "gallery",
    "rooms_preview",
    "location",
    "reviews",
    "blog_preview",
    "specials_preview",
    "form",
    "trust",
    "booking_search",
    "availability_calendar",
    "rate_table",
  ];
  for (const s of sections) {
    if (!keys.includes(s.type)) continue;
    const slice = (pool as Record<string, unknown>)[s.type];
    if (slice) data[s.id] = { type: s.type, data: slice } as SiteData[string];
  }
  return data;
}

/** First section that fails validation, so we can point the host straight at it. */
function firstInvalidSection(list: WebsiteSection[]): WebsiteSection | null {
  const res = sectionsSchema.safeParse(list);
  if (res.success) return null;
  const idx = res.error.issues[0]?.path[0];
  if (typeof idx === "number" && list[idx]) return list[idx];
  return list[0] ?? null;
}

export function PageBuilder({
  websiteId,
  pageId,
  pageTitle,
  subdomain,
  initialSections,
  brand,
  theme,
  nav,
  dataByType,
  initialNav,
  navPages,
  pageSlug,
  pageSeo,
  domain,
  ogImageUrl,
}: {
  websiteId: string;
  pageId: string;
  pageTitle: string;
  subdomain: string;
  initialSections: WebsiteSection[];
  brand: SiteBrand;
  theme: SiteThemeConfig;
  nav: SiteNavItem[];
  navigation: SiteNavigation;
  dataByType: Partial<SiteDataByType>;
  savedSections: SavedSection[];
  initialNav: NavigationConfig;
  navPages: NavPageOption[];
  brandName: string;
  pageSlug: string;
  pageSeo: { title: string; description: string; focusKeyword: string };
  domain: string;
  ogImageUrl?: string;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const localeRouter = useLocaleRouter();
  const [sections, setSections] = useState<WebsiteSection[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSections[0]?.id ?? null,
  );
  // Inline chrome editing — header/footer are selectable in the same canvas.
  const [navConfig, setNavConfig] = useState<NavigationConfig>(initialNav);
  const [selectedChrome, setSelectedChrome] = useState<ChromeTarget | null>(
    null,
  );
  const [navDirty, setNavDirty] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewing, setPreviewing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openingBrand, setOpeningBrand] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [publishing, startPublish] = useTransition();
  const [autoStatus, setAutoStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const previewData = useMemo(
    () => buildPreviewData(sections, dataByType),
    [sections, dataByType],
  );
  // Live page text for the SEO coach's keyword-in-body check.
  const bodyText = useMemo(() => extractSectionsText(sections), [sections]);
  const selected = selectedId
    ? (sections.find((s) => s.id === selectedId) ?? null)
    : null;

  // ── Selection: a section OR a chrome region (header/footer), never both ──
  const selectSection = (id: string) => {
    setSelectedId(id);
    setSelectedChrome(null);
  };
  const selectChrome = (target: ChromeTarget) => {
    setSelectedChrome(target);
    setSelectedId(null);
  };

  // ── Inline nav (chrome) editing ─────────────────────────────────────────
  const navMutate = (next: NavigationConfig) => {
    setNavConfig(next);
    setNavDirty(true);
  };
  const setHeader = (patch: Partial<NavigationConfig["header"]>) =>
    navMutate({ ...navConfig, header: { ...navConfig.header, ...patch } });
  const setTop = (patch: Partial<NavigationConfig["topBar"]>) =>
    navMutate({ ...navConfig, topBar: { ...navConfig.topBar, ...patch } });
  const setFooter = (patch: Partial<NavigationConfig["footer"]>) =>
    navMutate({ ...navConfig, footer: { ...navConfig.footer, ...patch } });
  const setMenu = (menu: NavigationConfig["menu"]) =>
    navMutate({ ...navConfig, menu });
  const setColumns = (columns: NavigationConfig["footer"]["columns"]) =>
    navMutate({ ...navConfig, footer: { ...navConfig.footer, columns } });

  function mutate(next: WebsiteSection[]) {
    setSections(next);
    setDirty(true);
  }
  const updateSection = (next: WebsiteSection) =>
    mutate(sections.map((s) => (s.id === next.id ? next : s)));
  const toggleEnabled = (id: string) =>
    mutate(
      sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  function removeSection(id: string) {
    mutate(sections.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicateSection(id: string) {
    const i = sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    const copy = {
      ...structuredClone(sections[i]),
      id: crypto.randomUUID(),
    } as WebsiteSection;
    mutate([...sections.slice(0, i + 1), copy, ...sections.slice(i + 1)]);
    selectSection(copy.id);
  }
  function addSection(type: SectionType, heroVariant?: HeroLayout) {
    const s = newSection(type);
    // Hero presets: insert a hero pre-set to the chosen layout so the host can
    // "pull in" a specific design from the sidebar, then edit photo/text/colour.
    if (heroVariant && s.type === "hero") {
      s.props = { ...s.props, variant: heroVariant };
    }
    const at = insertAt ?? sections.length;
    mutate([...sections.slice(0, at), s, ...sections.slice(at)]);
    selectSection(s.id);
    setInsertAt(null);
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    mutate(arrayMove(sections, oldIndex, newIndex));
  }

  // Open Brand Studio from the builder — flush any in-progress edits first so the
  // round-trip never drops work (brand edits are global; sections/nav reload on
  // return), then navigate to the Brand Studio route.
  async function openBrandStudio() {
    setOpeningBrand(true);
    if (dirty && !firstInvalidSection(sections)) {
      await saveDraftSectionsAction({ websiteId, pageId, sections });
      setDirty(false);
    }
    if (navDirty) {
      await saveNavigationAction({ websiteId, navigation: navConfig });
      setNavDirty(false);
    }
    localeRouter.push(`/dashboard/website/${websiteId}/brand`);
  }

  function onPublish() {
    const bad = firstInvalidSection(sections);
    if (bad) {
      setSelectedId(bad.id);
      toast.error(
        t("sectionInvalid", { section: t(`sectionType_${bad.type}`) }),
      );
      return;
    }
    startPublish(async () => {
      const draft = await saveDraftSectionsAction({
        websiteId,
        pageId,
        sections,
      });
      if (!draft.ok) {
        toast.error(t("draftSaveError"));
        return;
      }
      setDirty(false);
      // Persist any inline header/footer edits before the publish snapshot.
      if (navDirty) {
        const navRes = await saveNavigationAction({
          websiteId,
          navigation: navConfig,
        });
        if (!navRes.ok) {
          toast.error(t("draftSaveError"));
          return;
        }
        setNavDirty(false);
      }
      const res = await publishWebsiteAction(websiteId);
      if (!res.ok) {
        toast.error(t("publishError"));
        return;
      }
      toast.success(t("sitePublished"));
      router.refresh();
    });
  }

  // Debounced autosave — valid drafts persist ~1.5s after the last edit.
  useEffect(() => {
    if (!dirty || publishing) return;
    if (firstInvalidSection(sections)) {
      setAutoStatus("error");
      return;
    }
    const id = setTimeout(() => {
      setAutoStatus("saving");
      void saveDraftSectionsAction({ websiteId, pageId, sections }).then(
        (res) => {
          if (res.ok) {
            setDirty(false);
            setAutoStatus("saved");
          } else {
            setAutoStatus("error");
          }
        },
      );
    }, 1500);
    return () => clearTimeout(id);
  }, [sections, dirty, publishing, websiteId, pageId]);

  // Debounced autosave for inline header/footer (chrome) edits.
  useEffect(() => {
    if (!navDirty || publishing) return;
    const id = setTimeout(() => {
      setAutoStatus("saving");
      void saveNavigationAction({ websiteId, navigation: navConfig }).then(
        (res) => {
          if (res.ok) {
            setNavDirty(false);
            setAutoStatus("saved");
          } else {
            setAutoStatus("error");
          }
        },
      );
    }, 1500);
    return () => clearTimeout(id);
  }, [navConfig, navDirty, publishing, websiteId]);

  useEffect(() => {
    if (!dirty && !navDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, navDirty]);

  const deviceClass =
    device === "tablet"
      ? "device tablet"
      : device === "phone"
        ? "device mobile"
        : "device";
  const devices: Array<{ key: Device; icon: LucideIcon; title: string }> = [
    { key: "desktop", icon: Monitor, title: t("deviceDesktop") },
    { key: "tablet", icon: Tablet, title: t("deviceTablet") },
    { key: "phone", icon: Smartphone, title: t("devicePhone") },
  ];
  const autoLabel =
    autoStatus === "saving"
      ? t("autosaving")
      : dirty || navDirty
        ? t("unsavedChanges")
        : t("autosaved");

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
      <header className="etop">
        <Link href={`/dashboard/website/${websiteId}/pages`} className="eback">
          <ArrowLeft style={{ width: 16, height: 16 }} />
          {t("allPages")}
        </Link>
        <div className="epage">
          <span className="pico">
            <LayoutTemplate style={{ width: 16, height: 16 }} />
          </span>
          <div>
            <div className="ptit">{pageTitle}</div>
            <div className="psub">{subdomain}</div>
          </div>
        </div>

        {!previewing ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 14,
            }}
          >
            <div className="seg" role="group" aria-label={t("livePreview")}>
              {devices.map((d) => {
                const Ico = d.icon;
                return (
                  <button
                    key={d.key}
                    type="button"
                    title={d.title}
                    aria-pressed={device === d.key}
                    className={device === d.key ? "on" : ""}
                    onClick={() => setDevice(d.key)}
                  >
                    <Ico style={{ width: 16, height: 16 }} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {!previewing ? (
            <span className="savedot" aria-live="polite">
              {autoStatus === "saving" ? (
                <Loader2
                  className="animate-spin"
                  style={{ width: 13, height: 13 }}
                />
              ) : (
                <i />
              )}
              {autoLabel}
            </span>
          ) : null}
          {!previewing ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={openBrandStudio}
              disabled={openingBrand}
              title={t("brandStudioHint")}
            >
              {openingBrand ? (
                <Loader2
                  className="animate-spin"
                  style={{ width: 15, height: 15 }}
                />
              ) : (
                <Palette style={{ width: 15, height: 15 }} />
              )}
              {t("tabBrand")}
            </button>
          ) : null}
          {!previewing ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 style={{ width: 15, height: 15 }} />
              {t("pageSettings")}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setPreviewing((v) => !v);
              setSelectedId(null);
              setSelectedChrome(null);
            }}
          >
            <Eye style={{ width: 15, height: 15 }} />
            {previewing ? t("exitPreview") : t("previewCta")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onPublish}
            disabled={publishing}
          >
            {publishing ? (
              <Loader2
                className="animate-spin"
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <Rocket style={{ width: 15, height: 15 }} />
            )}
            {t("publishCta")}
          </button>
        </div>
      </header>

      <div className="ebody">
        {/* ── Palette ───────────────────────────────── */}
        {!previewing ? (
          <aside className="epanel l">
            <div className="epanel-h">
              <Blocks style={{ width: 16, height: 16, color: "#10B981" }} />
              <h3>{t("pbAddBlocks")}</h3>
            </div>
            <div className="epanel-b thin">
              {/* Search across every block + hero preset by name. */}
              <div className="pal-search-wrap">
                <Search
                  className="pal-search-ic"
                  style={{ width: 14, height: 14 }}
                />
                <input
                  type="text"
                  className="pal-search"
                  placeholder={t("pbSearchBlocks")}
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                />
                {paletteQuery ? (
                  <button
                    type="button"
                    className="pal-search-x"
                    onClick={() => setPaletteQuery("")}
                    aria-label={t("blockBgClear")}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                ) : null}
              </div>

              {insertAt !== null ? (
                <div className="pal-cat" style={{ color: "#064E3B" }}>
                  {t("pbInsertingHint")}
                </div>
              ) : null}

              {(() => {
                const q = paletteQuery.trim().toLowerCase();
                const heroCard = (variant: HeroLayout) => {
                  const Ico = HERO_ICONS[variant];
                  return (
                    <button
                      key={`hero-${variant}`}
                      type="button"
                      className="pal-item"
                      onClick={() => addSection("hero", variant)}
                    >
                      <span className="pi-ic">
                        <Ico style={{ width: 16, height: 16 }} />
                      </span>
                      <span className="pi-nm">
                        {t(`heroLayout_${variant}`)}
                      </span>
                    </button>
                  );
                };
                const typeCard = (type: SectionType) => {
                  const Ico = ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      className="pal-item"
                      onClick={() => addSection(type)}
                    >
                      <span className="pi-ic">
                        <Ico style={{ width: 16, height: 16 }} />
                      </span>
                      <span className="pi-nm">{t(`sectionType_${type}`)}</span>
                    </button>
                  );
                };

                // ── Filtered (flat) results ──────────────────────────
                if (q) {
                  const heroHits = HERO_LAYOUTS.filter(
                    (v) =>
                      t(`heroLayout_${v}`).toLowerCase().includes(q) ||
                      "hero".includes(q),
                  );
                  const typeHits = GROUPS.flatMap((g) => g.types).filter(
                    (type) =>
                      t(`sectionType_${type}`).toLowerCase().includes(q) ||
                      type.replace(/_/g, " ").includes(q),
                  );
                  if (heroHits.length + typeHits.length === 0) {
                    return (
                      <div className="pal-cat" style={{ fontWeight: 600 }}>
                        {t("pbNoResults")}
                      </div>
                    );
                  }
                  return (
                    <div className="pal-grid">
                      {heroHits.map(heroCard)}
                      {typeHits.map(typeCard)}
                    </div>
                  );
                }

                // ── Default grouped view ─────────────────────────────
                return (
                  <>
                    {/* Site parts — the shared header/footer (edit inline). */}
                    <div className="pal-cat">{t("pbSiteParts")}</div>
                    <div className="pal-grid">
                      <button
                        type="button"
                        style={{ cursor: "pointer" }}
                        className={`pal-item${selectedChrome === "header" ? "sel" : ""}`}
                        onClick={() => selectChrome("header")}
                      >
                        <span className="pi-ic">
                          <PanelTop style={{ width: 16, height: 16 }} />
                        </span>
                        <span className="pi-nm">{t("navHeaderTitle")}</span>
                      </button>
                      <button
                        type="button"
                        style={{ cursor: "pointer" }}
                        className={`pal-item${selectedChrome === "footer" ? "sel" : ""}`}
                        onClick={() => selectChrome("footer")}
                      >
                        <span className="pi-ic">
                          <PanelBottom style={{ width: 16, height: 16 }} />
                        </span>
                        <span className="pi-nm">{t("navFooterTitle")}</span>
                      </button>
                    </div>

                    {/* Heroes — the seven designed layouts. */}
                    <div className="pal-cat">{t("pbHeroes")}</div>
                    <div className="pal-grid">{HERO_LAYOUTS.map(heroCard)}</div>

                    {GROUPS.map((g) => (
                      <div key={g.key}>
                        <div className="pal-cat">{t(g.key)}</div>
                        <div className="pal-grid">{g.types.map(typeCard)}</div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </aside>
        ) : null}

        {/* ── Canvas (live theme/brand preview) ─────── */}
        <div className="canvas-wrap thin">
          <div className={deviceClass}>
            <SiteThemeRoot theme={theme}>
              <SiteChrome
                brand={brand}
                nav={nav}
                navigation={navConfig}
                header={theme.header}
                footer={theme.footer}
                editable={
                  previewing
                    ? undefined
                    : { selected: selectedChrome, onSelect: selectChrome }
                }
              >
                {sections.length === 0 ? (
                  <div className="canvas-empty">
                    <div className="ce-ic">
                      <Blocks style={{ width: 26, height: 26 }} />
                    </div>
                    <p style={{ marginTop: 12 }}>{t("noSections")}</p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={sections.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sections.map((s, i) => (
                        <BkBlock
                          key={s.id}
                          section={s}
                          index={i}
                          selected={selectedId === s.id}
                          previewing={previewing}
                          data={previewData}
                          onSelect={() => selectSection(s.id)}
                          onToggle={() => toggleEnabled(s.id)}
                          onDuplicate={() => duplicateSection(s.id)}
                          onRemove={() => removeSection(s.id)}
                          onInsertAfter={() => setInsertAt(i + 1)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </SiteChrome>
            </SiteThemeRoot>
          </div>
        </div>

        {/* ── Inspector ─────────────────────────────── */}
        {!previewing ? (
          <aside className="epanel r">
            <div className="epanel-h">
              <SlidersHorizontal
                style={{ width: 16, height: 16, color: "#10B981" }}
              />
              <h3>
                {selected
                  ? t(`sectionType_${selected.type}`)
                  : selectedChrome === "header"
                    ? t("navHeaderTitle")
                    : selectedChrome === "footer"
                      ? t("navFooterTitle")
                      : t("pbInspector")}
              </h3>
              {selected ? (
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="iconbtn"
                    title={
                      selected.enabled ? t("hideSection") : t("showSection")
                    }
                    onClick={() => toggleEnabled(selected.id)}
                  >
                    {selected.enabled ? (
                      <Eye style={{ width: 15, height: 15 }} />
                    ) : (
                      <EyeOff style={{ width: 15, height: 15 }} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    title={t("duplicateSection")}
                    onClick={() => duplicateSection(selected.id)}
                  >
                    <Copy style={{ width: 15, height: 15 }} />
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    title={t("deleteSection")}
                    onClick={() => removeSection(selected.id)}
                  >
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="epanel-b thin">
              {selectedChrome === "header" ? (
                <>
                  <HeaderInspector
                    nav={navConfig}
                    setHeader={setHeader}
                    setTop={setTop}
                  />
                  <div className="insp-sec">
                    <MenuBuilder
                      menu={navConfig.menu ?? []}
                      pages={navPages}
                      onChange={setMenu}
                    />
                  </div>
                </>
              ) : selectedChrome === "footer" ? (
                <FooterInspector
                  nav={navConfig}
                  pages={navPages}
                  setFooter={setFooter}
                  setColumns={setColumns}
                />
              ) : selected ? (
                <>
                  {isAutoPopulate(selected.type) ? (
                    <p className="insp-sec" style={{ fontSize: 12.5 }}>
                      {t("visualEditLiveHint")}
                    </p>
                  ) : null}
                  {/* Consistent 16px gutter so inspector controls don't sit flush
                      against the panel edges (matches the header padding). */}
                  <div className="p-4">
                    <SectionEditor
                      websiteId={websiteId}
                      section={selected}
                      onChange={updateSection}
                    />
                  </div>
                </>
              ) : (
                <div className="insp-empty">
                  <div className="ie-ic">
                    <SlidersHorizontal style={{ width: 22, height: 22 }} />
                  </div>
                  <p>{t("pbChromeHint")}</p>
                </div>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {previewing ? (
        <button
          type="button"
          className="btn btn-dark exitpv"
          onClick={() => setPreviewing(false)}
        >
          <X style={{ width: 15, height: 15 }} />
          {t("exitPreview")}
        </button>
      ) : null}

      <FormModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={t("pageSettings")}
        description={t("pageSettingsSub")}
        size="lg"
      >
        <div className="space-y-3">
          <PageSeoCard
            websiteId={websiteId}
            pageId={pageId}
            fallbackTitle={pageTitle}
            slug={pageSlug}
            bodyText={bodyText}
            domain={domain}
            ogImageUrl={ogImageUrl}
            initial={pageSeo}
          />
          <A11yCard sections={sections} />
        </div>
        <FormModalFooter>
          <FormModalCancel>{t("close")}</FormModalCancel>
        </FormModalFooter>
      </FormModal>
    </div>
  );
}

/** One canvas block — real section render wrapped in the `.bk` select/tools overlay. */
function BkBlock({
  section,
  index,
  selected,
  previewing,
  data,
  onSelect,
  onToggle,
  onDuplicate,
  onRemove,
  onInsertAfter,
}: {
  section: WebsiteSection;
  index: number;
  selected: boolean;
  previewing: boolean;
  data: SiteData;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onInsertAfter: () => void;
}) {
  const t = useTranslations("website");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  if (previewing) {
    return section.enabled ? (
      <SectionRenderer sections={[section]} data={data} asset={asset} />
    ) : null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bk${selected ? "sel" : ""}${isDragging ? "dragging" : ""}`}
      onClick={onSelect}
    >
      <div className="bk-label">
        <span className="bl-grip" {...attributes} {...listeners}>
          <GripVertical style={{ width: 13, height: 13 }} />
        </span>
        {t(`sectionType_${section.type}`)}
        {!section.enabled ? <span>· {t("hiddenLabel")}</span> : null}
      </div>
      <div className="bk-tools">
        <button
          type="button"
          title={section.enabled ? t("hideSection") : t("showSection")}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {section.enabled ? (
            <Eye style={{ width: 15, height: 15 }} />
          ) : (
            <EyeOff style={{ width: 15, height: 15 }} />
          )}
        </button>
        <button
          type="button"
          title={t("duplicateSection")}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy style={{ width: 15, height: 15 }} />
        </button>
        <span className="sepr" />
        <button
          type="button"
          className="del"
          title={t("deleteSection")}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 style={{ width: 15, height: 15 }} />
        </button>
      </div>

      <div style={{ opacity: section.enabled ? 1 : 0.45 }}>
        <SectionRenderer
          sections={[{ ...section, enabled: true }]}
          data={data}
          asset={asset}
        />
      </div>

      <div className="bk-insert">
        <span className="ins-line" />
        <button
          type="button"
          className="ins-btn"
          title={t("pbInsertHere")}
          aria-label={t("pbInsertHere")}
          onClick={(e) => {
            e.stopPropagation();
            onInsertAfter();
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
        </button>
      </div>
      <span className="sr-only">{index + 1}</span>
    </div>
  );
}
