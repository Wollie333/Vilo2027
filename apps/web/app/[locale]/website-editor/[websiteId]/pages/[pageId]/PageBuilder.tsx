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
  Redo2,
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
  Undo2,
  User,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link, useRouter as useLocaleRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  publishWebsiteAction,
  saveDraftSectionsAction,
  saveNavigationAction,
  setWebsiteLayoutAction,
} from "@/app/[locale]/dashboard/website/actions";
import type {
  NavigationConfig,
  SavedSection,
} from "@/app/[locale]/dashboard/website/schemas";
import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SafariShell } from "@/components/site/safari/SafariShell";
import { SiteChrome, type ChromeTarget } from "@/components/site/SiteChrome";
import { buildSafariNav } from "@/lib/site/safariNav";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
// Safari theme styles, scoped to `.vilo-safari`. Loaded in the editor bundle so
// the canvas can render the bespoke NenGama design when Safari is active (it
// never leaks: every rule is under .vilo-safari). Public site loads it via
// SafariShell.
import "@/components/site/safari/safari.css";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type {
  RoomDetail,
  SiteBrand,
  SiteData,
  SiteDataByType,
  SiteNavItem,
  SiteNavigation,
} from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";
import { newSection } from "@/lib/website/sectionDefaults";
import {
  getThemeSectionPresets,
  getThemeTemplates,
  themeGroupLabel,
  type ThemeSectionPreset,
  type ThemeTemplate,
} from "@/lib/website/themeSections";
import {
  HERO_LAYOUTS,
  isAutoPopulate,
  isRoomScoped,
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
    types: [
      "booking_search",
      "availability_calendar",
      "rate_table",
      "room_rates",
      "seasonal_pricing",
    ],
  },
  { key: "catLocation", types: ["location", "map"] },
  { key: "catConvert", types: ["cta", "contact_form", "form"] },
  { key: "catMore", types: ["rich_text", "faq"] },
  {
    key: "catElements",
    types: [
      "flex",
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
  room_rates: BadgeDollarSign,
  seasonal_pricing: CalendarDays,
  room_gallery: Images,
  room_overview: BedDouble,
  room_amenities: ListChecks,
  room_rate: BadgeDollarSign,
  el_heading: Heading,
  el_text: Pilcrow,
  el_image: ImageIcon,
  el_button: SquareMousePointer,
  el_spacer: MoveVertical,
  el_divider: Minus,
  columns: Columns3,
  flex: LayoutTemplate,
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
  sampleRoom?: RoomDetail | null,
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
    "room_rates",
    "seasonal_pricing",
  ];
  for (const s of sections) {
    // Room-scoped sections preview the sample room (on a room_detail page).
    if (sampleRoom && isRoomScoped(s.type)) {
      data[s.id] = { type: s.type, data: sampleRoom } as SiteData[string];
      continue;
    }
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
  initialLayout,
  pageKind,
  sampleRoom,
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
  pageSeo: {
    title: string;
    description: string;
    focusKeyword: string;
    image: string;
    pixelEvent: string;
    headCode: string;
  };
  domain: string;
  ogImageUrl?: string;
  initialLayout: "full" | "boxed";
  /** Page kind — drives the room-detail palette + preview affordances. */
  pageKind: string;
  /** Sample room for the room_detail preview (null on other pages). */
  sampleRoom: RoomDetail | null;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const localeRouter = useLocaleRouter();
  // Theme-attached designed sections (sidebar group named after the theme).
  const themePresets = getThemeSectionPresets(theme.preset);
  const themeTemplates = getThemeTemplates(theme.preset);
  const themeLabel = themeGroupLabel(theme.preset);
  // Safari renders + edits its bespoke header/footer inline in this canvas.
  const themeIsSafari = theme.preset === "safari";
  // Palette groups — the room-scoped blocks only make sense on the room_detail
  // template, so surface that group there (and only there).
  const paletteGroups: Array<{ key: string; types: SectionType[] }> =
    pageKind === "room_detail"
      ? [
          {
            key: "catRoom",
            types: [
              "room_gallery",
              "room_overview",
              "room_amenities",
              "room_rate",
            ],
          },
          ...GROUPS,
        ]
      : GROUPS;
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
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // Site width (full / boxed) — applies to the whole site; persisted on toggle
  // and reflected live in the canvas preview.
  const [siteLayout, setSiteLayout] = useState<"full" | "boxed">(initialLayout);
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
    () => buildPreviewData(sections, dataByType, sampleRoom),
    [sections, dataByType, sampleRoom],
  );
  // Live page text for the SEO coach's keyword-in-body check.
  const bodyText = useMemo(() => extractSectionsText(sections), [sections]);
  const selected = selectedId
    ? (sections.find((s) => s.id === selectedId) ?? null)
    : null;

  // ── Selection: only sections are selectable in the page editor. Header/footer
  // are theme elements, edited in the Navigation manager — never here. ──
  const selectSection = (id: string) => {
    setSelectedId(id);
    setSelectedChrome(null);
  };
  // Safari: header/footer are selectable inline in the canvas (mutually exclusive
  // with a section selection), edited via the same Header/Footer inspectors.
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

  // ── Undo / redo history ────────────────────────────────────────────────
  // A snapshot stack of section states. Structural edits (add/remove/reorder/
  // duplicate/toggle/template) push a discrete entry; inspector field typing
  // passes `coalesce` so a burst of keystrokes collapses into ONE undo step.
  const pastRef = useRef<WebsiteSection[][]>([]);
  const futureRef = useRef<WebsiteSection[][]>([]);
  const lastSnapRef = useRef(0);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  // Latest nav config, so an in-flight chrome autosave can tell whether the
  // snapshot it saved is still current before clearing the dirty flag.
  const navConfigRef = useRef(navConfig);
  navConfigRef.current = navConfig;
  const [, bumpHistory] = useState(0);
  const refreshHistory = () => bumpHistory((v) => v + 1);

  function mutate(next: WebsiteSection[], opts?: { coalesce?: boolean }) {
    const now = Date.now();
    const burst =
      !!opts?.coalesce &&
      now - lastSnapRef.current < 700 &&
      lastSnapRef.current > 0;
    lastSnapRef.current = now;
    if (!burst) {
      pastRef.current = [...pastRef.current, sections].slice(-50);
      refreshHistory();
    }
    futureRef.current = [];
    setSections(next);
    setDirty(true);
  }
  function undo() {
    const past = pastRef.current;
    if (!past.length) return;
    const prev = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, sectionsRef.current].slice(-50);
    lastSnapRef.current = 0;
    setSections(prev);
    setDirty(true);
    refreshHistory();
  }
  function redo() {
    const future = futureRef.current;
    if (!future.length) return;
    const next = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, sectionsRef.current].slice(-50);
    lastSnapRef.current = 0;
    setSections(next);
    setDirty(true);
    refreshHistory();
  }
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const updateSection = (next: WebsiteSection) =>
    mutate(
      sections.map((s) => (s.id === next.id ? next : s)),
      { coalesce: true },
    );
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
  // Pull in a professionally-designed, theme-attached section (pre-styled).
  function addThemePreset(preset: ThemeSectionPreset) {
    const s = preset.make();
    const at = insertAt ?? sections.length;
    mutate([...sections.slice(0, at), s, ...sections.slice(at)]);
    selectSection(s.id);
    setInsertAt(null);
  }
  // Start a page from a designed theme template — APPENDS its sections (so it
  // never destroys existing work; on an empty page it simply starts it).
  function applyTemplate(tpl: ThemeTemplate) {
    const next = tpl.make();
    mutate([...sections, ...next]);
    if (next[0]) selectSection(next[0].id);
    setTemplatesOpen(false);
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

  // Site width (full / boxed) — persists immediately + updates the live preview;
  // reverts on failure. A site-wide setting surfaced in the builder (like Brand).
  function changeLayout(next: "full" | "boxed") {
    if (next === siteLayout) return;
    const prev = siteLayout;
    setSiteLayout(next);
    setWebsiteLayoutAction(websiteId, next).then((r) => {
      if (!r.ok) {
        setSiteLayout(prev);
        toast.error(t("layoutSaveFailed"));
      } else {
        toast.success(t("layoutSaved"));
      }
    });
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
  // We clear `dirty` only when the *saved* snapshot is still the current one:
  // an edit made while a save is in flight must not be marked saved by the
  // older save resolving (that would cancel its own pending save and lose it).
  useEffect(() => {
    if (!dirty || publishing) return;
    if (firstInvalidSection(sections)) {
      setAutoStatus("error");
      return;
    }
    const snapshot = sections;
    const id = setTimeout(() => {
      setAutoStatus("saving");
      void saveDraftSectionsAction({
        websiteId,
        pageId,
        sections: snapshot,
      }).then((res) => {
        if (res.ok) {
          if (sectionsRef.current === snapshot) setDirty(false);
          setAutoStatus("saved");
        } else {
          setAutoStatus("error");
        }
      });
    }, 1500);
    return () => clearTimeout(id);
  }, [sections, dirty, publishing, websiteId, pageId]);

  // Debounced autosave for inline header/footer (chrome) edits.
  useEffect(() => {
    if (!navDirty || publishing) return;
    const snapshot = navConfig;
    const id = setTimeout(() => {
      setAutoStatus("saving");
      void saveNavigationAction({ websiteId, navigation: snapshot }).then(
        (res) => {
          if (res.ok) {
            if (navConfigRef.current === snapshot) setNavDirty(false);
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

  // Force an immediate draft save (⌘/Ctrl+S) — autosave already covers idle, this
  // gives explicit "save now" feedback. No-ops when clean or invalid.
  function saveNow() {
    if (!dirty || publishing) return;
    if (firstInvalidSection(sections)) {
      setAutoStatus("error");
      toast.error(t("draftSaveError"));
      return;
    }
    const snapshot = sections;
    setAutoStatus("saving");
    void saveDraftSectionsAction({
      websiteId,
      pageId,
      sections: snapshot,
    }).then((res) => {
      if (res.ok) {
        if (sectionsRef.current === snapshot) setDirty(false);
        setAutoStatus("saved");
      } else {
        setAutoStatus("error");
      }
    });
  }

  // Keyboard shortcuts. The listener mounts once; a ref carries the latest
  // handlers + selection so it never goes stale. ⌘/Ctrl+Z undo, ⇧+Z (or ⌘/Ctrl+Y)
  // redo, ⌘/Ctrl+S save, Delete/Backspace removes the selected section. Edits
  // inside a text field / contenteditable (e.g. the rich-text editor) keep their
  // own native undo — we never hijack those.
  const shortcutRef = useRef({
    undo,
    redo,
    saveNow,
    removeSection,
    selectedId,
    previewing,
  });
  shortcutRef.current = {
    undo,
    redo,
    saveNow,
    removeSection,
    selectedId,
    previewing,
  };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const el = document.activeElement as HTMLElement | null;
      const editable =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      const s = shortcutRef.current;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        s.saveNow();
        return;
      }
      if (mod && key === "z") {
        if (editable) return;
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === "y") {
        if (editable) return;
        e.preventDefault();
        s.redo();
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (editable || s.previewing || !s.selectedId) return;
        e.preventDefault();
        s.removeSection(s.selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            {/* Site width — full (edge-to-edge) vs boxed (centred). */}
            <div
              className="seg"
              role="group"
              aria-label={t("fldSiteWidth")}
              style={{ marginLeft: 6 }}
            >
              <button
                type="button"
                title={t("siteWidth_full")}
                aria-pressed={siteLayout === "full"}
                className={siteLayout === "full" ? "on" : ""}
                onClick={() => changeLayout("full")}
              >
                <Monitor style={{ width: 16, height: 16 }} />
              </button>
              <button
                type="button"
                title={t("siteWidth_boxed")}
                aria-pressed={siteLayout === "boxed"}
                className={siteLayout === "boxed" ? "on" : ""}
                onClick={() => changeLayout("boxed")}
              >
                <LayoutTemplate style={{ width: 16, height: 16 }} />
              </button>
            </div>
            {/* Undo / redo of section edits. */}
            <div
              className="seg"
              role="group"
              aria-label={t("pbUndo")}
              style={{ marginLeft: 6 }}
            >
              <button
                type="button"
                title={`${t("pbUndo")} (Ctrl+Z)`}
                aria-label={t("pbUndo")}
                disabled={!canUndo}
                onClick={undo}
              >
                <Undo2 style={{ width: 16, height: 16 }} />
              </button>
              <button
                type="button"
                title={`${t("pbRedo")} (Ctrl+Shift+Z)`}
                aria-label={t("pbRedo")}
                disabled={!canRedo}
                onClick={redo}
              >
                <Redo2 style={{ width: 16, height: 16 }} />
              </button>
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
          {!previewing && themeTemplates.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setTemplatesOpen(true)}
              title={t("pbTemplatesSub")}
            >
              <LayoutTemplate style={{ width: 15, height: 15 }} />
              {t("pbTemplates")}
            </button>
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
                const themeCard = (preset: ThemeSectionPreset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className="pal-item"
                    onClick={() => addThemePreset(preset)}
                  >
                    <span className="pi-ic">
                      <Sparkles style={{ width: 16, height: 16 }} />
                    </span>
                    <span className="pi-nm">{preset.label}</span>
                  </button>
                );

                // ── Filtered (flat) results ──────────────────────────
                if (q) {
                  const heroHits = HERO_LAYOUTS.filter(
                    (v) =>
                      t(`heroLayout_${v}`).toLowerCase().includes(q) ||
                      "hero".includes(q),
                  );
                  const typeHits = paletteGroups
                    .flatMap((g) => g.types)
                    .filter(
                      (type) =>
                        t(`sectionType_${type}`).toLowerCase().includes(q) ||
                        type.replace(/_/g, " ").includes(q),
                    );
                  const themeHits = themePresets.filter((p) =>
                    p.label.toLowerCase().includes(q),
                  );
                  if (
                    heroHits.length + typeHits.length + themeHits.length ===
                    0
                  ) {
                    return (
                      <div className="pal-cat" style={{ fontWeight: 600 }}>
                        {t("pbNoResults")}
                      </div>
                    );
                  }
                  return (
                    <div className="pal-grid">
                      {themeHits.map(themeCard)}
                      {heroHits.map(heroCard)}
                      {typeHits.map(typeCard)}
                    </div>
                  );
                }

                // ── Default grouped view ─────────────────────────────
                return (
                  <>
                    {/* Site parts. On Safari the header/footer are edited inline
                        here (select to edit); other themes edit them in the
                        Navigation manager. */}
                    <div className="pal-cat">{t("pbSiteParts")}</div>
                    {themeIsSafari ? (
                      <div className="pal-grid">
                        <button
                          type="button"
                          className={
                            selectedChrome === "header"
                              ? "pal-item sel"
                              : "pal-item"
                          }
                          onClick={() => selectChrome("header")}
                        >
                          <PanelTop style={{ width: 18, height: 18 }} />
                          <span>{t("navHeaderTitle")}</span>
                        </button>
                        <button
                          type="button"
                          className={
                            selectedChrome === "footer"
                              ? "pal-item sel"
                              : "pal-item"
                          }
                          onClick={() => selectChrome("footer")}
                        >
                          <PanelBottom style={{ width: 18, height: 18 }} />
                          <span>{t("navFooterTitle")}</span>
                        </button>
                      </div>
                    ) : (
                      <p
                        className="px-1 pb-2 text-[11.5px] leading-snug"
                        style={{ color: "var(--mute)" }}
                      >
                        {t("pbChromeInNav")}
                      </p>
                    )}

                    {/* Heroes — the seven designed layouts. */}
                    <div className="pal-cat">{t("pbHeroes")}</div>
                    <div className="pal-grid">{HERO_LAYOUTS.map(heroCard)}</div>

                    {/* Theme-attached designed sections (named after the theme). */}
                    {themePresets.length > 0 ? (
                      <>
                        <div className="pal-cat">{themeLabel}</div>
                        <div className="pal-grid">
                          {themePresets.map(themeCard)}
                        </div>
                      </>
                    ) : null}

                    {paletteGroups.map((g) => (
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
            {(() => {
              const isSafari = theme.preset === "safari";
              const themeVariant = isSafari ? "safari" : undefined;
              const body =
                sections.length === 0 ? (
                  <div className="canvas-empty">
                    <div className="ce-ic">
                      <Blocks style={{ width: 26, height: 26 }} />
                    </div>
                    <p style={{ marginTop: 12 }}>{t("noSections")}</p>
                    {themeTemplates.length > 0 ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 14 }}
                        onClick={() => setTemplatesOpen(true)}
                      >
                        <LayoutTemplate style={{ width: 15, height: 15 }} />
                        {t("pbStartFromTemplate")}
                      </button>
                    ) : null}
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
                          themeVariant={themeVariant}
                          onSelect={() => selectSection(s.id)}
                          onToggle={() => toggleEnabled(s.id)}
                          onDuplicate={() => duplicateSection(s.id)}
                          onRemove={() => removeSection(s.id)}
                          onInsertAfter={() => setInsertAt(i + 1)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                );

              // Safari renders its bespoke chrome (the SAME SafariShell as the live
              // site, with the header/footer click-to-select), so the builder
              // matches the published NenGama look AND the chrome is editable here
              // — like the page sections. Other themes render the generic chrome.
              if (isSafari) {
                return (
                  <SafariShell
                    brandName={brand.name}
                    nav={buildSafariNav({
                      nav,
                      navigation: navConfig,
                      brand,
                      preview: false,
                      subdomain: "",
                    })}
                    editable={
                      previewing
                        ? undefined
                        : { selected: selectedChrome, onSelect: selectChrome }
                    }
                  >
                    {body}
                  </SafariShell>
                );
              }
              return (
                <SiteThemeRoot theme={theme}>
                  <SiteChrome
                    brand={brand}
                    nav={nav}
                    navigation={navConfig}
                    header={theme.header}
                    footer={theme.footer}
                    layout={siteLayout}
                    /* Header/footer are theme elements — shown here for context
                       but edited in the Navigation manager, never per-page. So
                       the chrome is inert (no click-to-select, links dead). */
                    chromeInert
                  >
                    {body}
                  </SiteChrome>
                </SiteThemeRoot>
              );
            })()}
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
                    pages={navPages}
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
                      themePreset={theme.preset}
                      accountContact={{
                        email: brand.contactEmail,
                        phone: brand.contactPhone,
                      }}
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

      {/* Theme page-template gallery — start a page from a designed layout. */}
      <FormModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        title={t("pbTemplates")}
        description={t("pbTemplatesSub")}
        size="lg"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {themeTemplates.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="flex flex-col items-start gap-1 rounded-[12px] border border-brand-line bg-white p-4 text-left transition hover:border-brand-primary hover:bg-brand-accent/20"
            >
              <span className="flex items-center gap-2 text-[14px] font-semibold text-brand-ink">
                <LayoutTemplate
                  style={{ width: 15, height: 15, color: "#10B981" }}
                />
                {tpl.label}
              </span>
              <span className="text-[12px] leading-snug text-brand-mute">
                {tpl.description}
              </span>
            </button>
          ))}
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
  themeVariant,
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
  themeVariant?: string;
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
      <SectionRenderer
        sections={[section]}
        data={data}
        asset={asset}
        themeVariant={themeVariant}
        errorLabel={t("sectionRenderError")}
      />
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
          themeVariant={themeVariant}
          errorLabel={t("sectionRenderError")}
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
