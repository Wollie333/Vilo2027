"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Palette,
  RotateCcw,
  Upload,
  Save,
  Monitor,
  Smartphone,
  Lock,
  CircleUserRound,
  Type as TypeIcon,
  RectangleHorizontal,
  Image as ImageIcon,
  Share2,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Linkedin,
  Globe,
  Link2 as LinkIcon,
  type LucideIcon,
} from "lucide-react";

import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { SiteChrome } from "@/components/site/SiteChrome";
import { PageDocRenderer } from "@/components/site/v2/PageDocRenderer";
import { pageStartsWithHero } from "@/lib/website/pageDocOps";
import type { SiteBrand, SiteNavigation } from "@/lib/site/types";
import type { PageDoc } from "@/lib/website/pageDoc.schema";
import {
  SITE_PRESETS,
  themeSwatches,
  type SiteThemeConfig,
  type SiteFont,
  type SiteRadius,
  type SiteShadow,
} from "@/lib/site/themes";
import { ThemeColorPicker } from "@/components/ui/ThemeColorPicker";

// Builder V2 — Phase 4c: Brand Studio overlay (token-driven).
//
// A pixel-faithful port of the prototype's `.bse-*` Brand Studio, mapped onto
// the REAL theme model: the rail edits a WORKING `SiteThemeConfig` (+ a small
// `brand` record) and the preview is the REAL builder canvas re-themed live via
// `SiteThemeRoot` + `PageDocRenderer` — the token-driven thesis of the redesign,
// no mock preview site. Persisting the brand to the DB is the next slice (4c-2);
// for now edits apply live to the working theme (and the builder canvas).

export type Brand = {
  name?: string;
  tagline?: string;
  monogram?: string;
  socials?: {
    instagram?: string;
    facebook?: string;
    x?: string;
    youtube?: string;
    linkedin?: string;
    website?: string;
  };
};

const FONTS: [SiteFont, string][] = [
  ["sans", "Sans"],
  ["serif", "Serif"],
  ["elegant", "Elegant"],
  ["grotesk", "Grotesk"],
  ["editorial", "Editorial"],
  ["homely", "Homely"],
];
const RADII: [SiteRadius, string][] = [
  ["none", "Sharp"],
  ["sm", "Small"],
  ["md", "Medium"],
  ["lg", "Large"],
  ["xl", "Round"],
];
const ACCENTS = [
  "#C2522E",
  "#B26C2E",
  "#0E8FB0",
  "#2E7D6B",
  "#9C3B52",
  "#3E6C8E",
  "#221A11",
];
const PRESET_KEYS = Object.keys(SITE_PRESETS) as (keyof typeof SITE_PRESETS)[];

export function BrandStudioOverlay({
  open,
  onClose,
  siteLabel,
  domain,
  theme,
  onThemeChange,
  brand,
  onBrandChange,
  doc,
  navigation,
  persists,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  siteLabel: string;
  domain: string;
  theme: SiteThemeConfig;
  onThemeChange: (next: SiteThemeConfig) => void;
  brand: Brand;
  onBrandChange: (next: Brand) => void;
  doc: PageDoc;
  /** Site navigation → the brand-studio canvas renders the real header/menu/footer
   *  so the host sees the nav styled with their brand while designing. */
  navigation?: SiteNavigation;
  persists: boolean;
  onPublish: (mode: "draft" | "publish") => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [openAcc, setOpenAcc] = useState<Set<number>>(() => new Set([0, 1]));
  const [pubOpen, setPubOpen] = useState(false);

  const toggleAcc = (i: number) =>
    setOpenAcc((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  // ── resolved-current helpers (for highlight state) ──
  const preset =
    theme.base ??
    SITE_PRESETS[(theme.preset as keyof typeof SITE_PRESETS) ?? "warm"] ??
    SITE_PRESETS.warm;
  const curAccent = (
    theme.colors?.accent || preset.palette.accent
  ).toLowerCase();
  const curHeadFont =
    theme.type?.headingFont ?? theme.base?.font ?? preset.font;
  const curBodyFont = theme.type?.bodyFont ?? theme.base?.font ?? preset.font;
  const curRadius = theme.radius ?? theme.base?.radius ?? preset.radius;
  const curPill = theme.buttons?.primary?.pill ?? false;
  const curCardShadow = theme.card?.shadow ?? "md";
  const curSocialShape = theme.social?.shape ?? "round";

  // ── patch helpers (produce a fully-merged working theme) ──
  const patch = (p: Partial<SiteThemeConfig>) =>
    onThemeChange({ ...theme, ...p });
  const patchType = (t: Partial<NonNullable<SiteThemeConfig["type"]>>) =>
    onThemeChange({ ...theme, type: { ...theme.type, ...t } });
  const patchCard = (c: Partial<NonNullable<SiteThemeConfig["card"]>>) =>
    onThemeChange({ ...theme, card: { ...theme.card, ...c } });
  const patchImage = (i: Partial<NonNullable<SiteThemeConfig["image"]>>) =>
    onThemeChange({ ...theme, image: { ...theme.image, ...i } });
  const patchSocial = (s: Partial<NonNullable<SiteThemeConfig["social"]>>) =>
    onThemeChange({ ...theme, social: { ...theme.social, ...s } });
  const setAccent = (hex: string) =>
    onThemeChange({
      ...theme,
      colors: { ...theme.colors, accent: hex },
    });
  const setPill = (pill: boolean) =>
    onThemeChange({
      ...theme,
      buttons: {
        ...theme.buttons,
        primary: { ...theme.buttons?.primary, pill },
        secondary: { ...theme.buttons?.secondary, pill },
      },
    });
  const selectPreset = (key: keyof typeof SITE_PRESETS) =>
    onThemeChange({
      ...theme,
      preset: key,
      base: SITE_PRESETS[key],
      // adopt the preset as a full kit: accent + fonts follow it
      colors: { ...theme.colors, accent: undefined },
      type: { ...theme.type, headingFont: undefined, bodyFont: undefined },
    });

  const setBrand = (p: Partial<Brand>) => onBrandChange({ ...brand, ...p });
  const setSocial = (p: Partial<NonNullable<Brand["socials"]>>) =>
    onBrandChange({ ...brand, socials: { ...brand.socials, ...p } });

  const cls = ["bse-overlay", open && "show", open && "in"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} aria-hidden={!open}>
      {/* overlay topbar */}
      <header className="bse-top">
        <button className="bse-back" type="button" onClick={onClose}>
          <ChevronLeft size={16} strokeWidth={2} />
          Back to builder
        </button>
        <div className="bse-div" />
        <div className="bse-title">
          <span className="bse-mark">
            <Palette size={16} strokeWidth={1.9} />
          </span>
          <div>
            <b>Brand Studio</b>
            <small>{siteLabel} · public website</small>
          </div>
        </div>
        <div className="bse-spacer" />
        <button
          className="tb-ico"
          type="button"
          title="Reset brand to the theme defaults"
          style={{ color: "#BFE3D3" }}
          onClick={() =>
            selectPreset((theme.preset as keyof typeof SITE_PRESETS) ?? "warm")
          }
        >
          <RotateCcw size={18} strokeWidth={1.9} />
        </button>
        <div className="tb-publish">
          <button
            className="tb-btn solid"
            type="button"
            onClick={() => onPublish("publish")}
            disabled={!persists}
            title={
              persists
                ? "Publish brand to every page"
                : "Open a real page to publish"
            }
          >
            <Upload size={16} strokeWidth={1.9} />
            Publish brand
          </button>
          <button
            className="tb-caret"
            type="button"
            title="Publish options"
            onClick={(e) => {
              e.stopPropagation();
              setPubOpen((o) => !o);
            }}
          >
            <ChevronDown size={14} strokeWidth={2.2} />
          </button>
          <div
            className={pubOpen ? "tb-menu show" : "tb-menu"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setPubOpen(false);
                onPublish("draft");
              }}
            >
              <span className="mi">
                <Save size={16} strokeWidth={1.9} />
              </span>
              <span>
                <b>Save as draft</b>
                <small>Preview without going live</small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPubOpen(false);
                onPublish("publish");
              }}
            >
              <span className="mi">
                <Upload size={16} strokeWidth={1.9} />
              </span>
              <span>
                <b>Publish brand</b>
                <small>Apply across every page</small>
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="bse-body">
        {/* rail */}
        <aside className="bse-rail">
          <Acc
            i={0}
            openAcc={openAcc}
            toggle={toggleAcc}
            Icon={CircleUserRound}
            title="Identity"
            sub="Name, monogram & tagline"
          >
            <Ctl label="Site name">
              <input
                className="bse-input"
                maxLength={32}
                value={brand.name ?? ""}
                onChange={(e) => setBrand({ name: e.target.value })}
              />
            </Ctl>
            <Ctl label="Tagline" hint="under the logo">
              <input
                className="bse-input"
                maxLength={44}
                value={brand.tagline ?? ""}
                onChange={(e) => setBrand({ tagline: e.target.value })}
              />
            </Ctl>
            <Ctl label="Logo monogram">
              <div className="bse-id">
                <input
                  className="bse-input mono"
                  maxLength={2}
                  value={brand.monogram ?? ""}
                  onChange={(e) => setBrand({ monogram: e.target.value })}
                />
                <div className="note">
                  The letter mark shown when no logo image is uploaded.
                </div>
              </div>
            </Ctl>
          </Acc>

          <Acc
            i={1}
            openAcc={openAcc}
            toggle={toggleAcc}
            Icon={Palette}
            title="Colour"
            sub="Palette & brand accent"
          >
            <Ctl label="Base palette">
              <div className="bse-pal">
                {PRESET_KEYS.map((k) => {
                  const p = SITE_PRESETS[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      className={
                        theme.preset === k ? "bse-palcard on" : "bse-palcard"
                      }
                      onClick={() => selectPreset(k)}
                    >
                      <span className="strip">
                        {[p.palette.bg, p.palette.accent, p.palette.ink].map(
                          (c, i) => (
                            <span key={i} style={{ background: c }} />
                          ),
                        )}
                      </span>
                      <span className="nm">{p.label}</span>
                      <span className="tone">{p.font}</span>
                    </button>
                  );
                })}
              </div>
            </Ctl>
            <Ctl label="Brand accent">
              <div className="bse-swgrid">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={
                      curAccent === c.toLowerCase() ? "bse-sw on" : "bse-sw"
                    }
                    style={{ background: c }}
                    onClick={() => setAccent(c)}
                    aria-label={`Accent ${c}`}
                  />
                ))}
              </div>
            </Ctl>
          </Acc>

          <Acc
            i={2}
            openAcc={openAcc}
            toggle={toggleAcc}
            Icon={TypeIcon}
            title="Typography"
            sub="Fonts & weight"
          >
            <Ctl label="Heading font">
              <select
                className="bse-select"
                value={curHeadFont}
                onChange={(e) =>
                  patchType({ headingFont: e.target.value as SiteFont })
                }
              >
                {FONTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Ctl>
            <Ctl label="Body font">
              <select
                className="bse-select"
                value={curBodyFont}
                onChange={(e) =>
                  patchType({ bodyFont: e.target.value as SiteFont })
                }
              >
                {FONTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Ctl>
            <Ctl label="Heading weight">
              <Rng
                min={300}
                max={800}
                step={100}
                value={theme.type?.headingWeight ?? 600}
                onChange={(v) => patchType({ headingWeight: v })}
              />
            </Ctl>
          </Acc>

          <Acc
            i={3}
            openAcc={openAcc}
            toggle={toggleAcc}
            Icon={RectangleHorizontal}
            title="Buttons & corners"
            sub="Shape language"
          >
            <Ctl label="UI corner radius">
              <div className="bse-seg">
                {RADII.map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={curRadius === v ? "opt on" : "opt"}
                    onClick={() => patch({ radius: v })}
                  >
                    <span className="nm">{l}</span>
                  </button>
                ))}
              </div>
            </Ctl>
            <Ctl label="Button shape">
              <div className="bse-seg">
                <button
                  type="button"
                  className={!curPill ? "opt on" : "opt"}
                  onClick={() => setPill(false)}
                >
                  <span className="dia">
                    <span className="bar" style={{ borderRadius: "4px" }} />
                  </span>
                  <span className="nm">Square</span>
                </button>
                <button
                  type="button"
                  className={curPill ? "opt on" : "opt"}
                  onClick={() => setPill(true)}
                >
                  <span className="dia">
                    <span className="bar" style={{ borderRadius: "999px" }} />
                  </span>
                  <span className="nm">Pill</span>
                </button>
              </div>
            </Ctl>
          </Acc>

          <Acc
            i={4}
            openAcc={openAcc}
            toggle={toggleAcc}
            Icon={ImageIcon}
            title="Images & cards"
            sub="Radius & shadow"
          >
            <Ctl label="Image corner radius">
              <Rng
                min={0}
                max={28}
                step={1}
                suffix="px"
                value={theme.image?.radius ?? 8}
                onChange={(v) => patchImage({ radius: v })}
              />
            </Ctl>
            <Ctl label="Room card radius">
              <Rng
                min={0}
                max={28}
                step={1}
                suffix="px"
                value={theme.card?.radius ?? 8}
                onChange={(v) => patchCard({ radius: v })}
              />
            </Ctl>
            <Ctl label="Card shadow">
              <div className="bse-seg">
                {(
                  [
                    ["none", "None"],
                    ["md", "Soft"],
                    ["xl", "Deep"],
                  ] as [SiteShadow, string][]
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={curCardShadow === v ? "opt on" : "opt"}
                    onClick={() => patchCard({ shadow: v })}
                  >
                    <span className="nm">{l}</span>
                  </button>
                ))}
              </div>
            </Ctl>
          </Acc>

          <Acc
            i={5}
            openAcc={openAcc}
            toggle={toggleAcc}
            Icon={Share2}
            title="Social channels"
            sub="Footer links & icons"
          >
            <Ctl label="Channels" hint="blank = hidden">
              {(
                [
                  ["instagram", Instagram, "instagram.com/you"],
                  ["facebook", Facebook, "facebook.com/you"],
                  ["x", Twitter, "x.com/you"],
                  ["youtube", Youtube, "youtube.com/@you"],
                  ["linkedin", Linkedin, "linkedin.com/company/you"],
                  ["website", Globe, "yourwebsite.com"],
                ] as [keyof NonNullable<Brand["socials"]>, LucideIcon, string][]
              ).map(([key, Icon, placeholder]) => (
                <div className="bse-soc" key={key}>
                  <span className="ic">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <input
                    className="bse-input"
                    placeholder={placeholder}
                    value={brand.socials?.[key] ?? ""}
                    onChange={(e) => setSocial({ [key]: e.target.value })}
                  />
                </div>
              ))}
            </Ctl>
            <Ctl label="Icon shape">
              <div className="bse-seg">
                {(
                  [
                    ["round", "Circle"],
                    ["square", "Rounded"],
                  ] as ["round" | "square", string][]
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={curSocialShape === v ? "opt on" : "opt"}
                    onClick={() => patchSocial({ shape: v })}
                  >
                    <span className="nm">{l}</span>
                  </button>
                ))}
              </div>
            </Ctl>
          </Acc>

          <Acc
            i={6}
            openAcc={openAcc}
            toggle={toggleAcc}
            Icon={LinkIcon}
            title="Links"
            sub="Content link colour & hover"
          >
            <Ctl label="Link colour" hint="body / prose links">
              <ThemeColorPicker
                value={theme.links?.color}
                fallback={theme.colors?.accent ?? "#0F766E"}
                swatches={themeSwatches(theme)}
                onChange={(v) => patch({ links: { ...theme.links, color: v } })}
                onReset={() => patch({ links: { ...theme.links, color: "" } })}
              />
            </Ctl>
            <Ctl label="Link hover colour">
              <ThemeColorPicker
                value={theme.links?.hoverColor}
                fallback={theme.colors?.accent ?? "#0F766E"}
                swatches={themeSwatches(theme)}
                onChange={(v) =>
                  patch({ links: { ...theme.links, hoverColor: v } })
                }
                onReset={() =>
                  patch({ links: { ...theme.links, hoverColor: "" } })
                }
              />
            </Ctl>
          </Acc>
        </aside>

        {/* live preview — the REAL canvas, re-themed by the working theme */}
        <div className="bse-stage">
          <div className="bse-chrome">
            <div className="bse-dots">
              <span style={{ background: "#FF5F57" }} />
              <span style={{ background: "#FEBC2E" }} />
              <span style={{ background: "#28C840" }} />
            </div>
            <div className="bse-url">
              <Lock size={12} strokeWidth={2} color="#34D399" />
              {domain}
            </div>
            <div className="bse-spacer" />
            <div className="bse-devtog">
              <button
                type="button"
                className={
                  device === "desktop" ? "bse-devbtn on" : "bse-devbtn"
                }
                title="Desktop"
                onClick={() => setDevice("desktop")}
              >
                <Monitor size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className={device === "mobile" ? "bse-devbtn on" : "bse-devbtn"}
                title="Mobile"
                onClick={() => setDevice("mobile")}
              >
                <Smartphone size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <div className="bse-scroll">
            <div
              className={
                device === "mobile" ? "bse-device mobile" : "bse-device"
              }
            >
              {open && (
                <SiteThemeRoot theme={theme}>
                  <SiteChrome
                    brand={{
                      name: brand.name?.trim() || siteLabel,
                      tagline: brand.tagline ?? null,
                      monogram: brand.monogram ?? null,
                      socials: brand.socials as SiteBrand["socials"],
                    }}
                    nav={(navigation?.menu ?? []).map((m) => ({
                      label: m.label,
                      href: m.href,
                    }))}
                    navigation={navigation ?? {}}
                    header={theme.header}
                    footer={theme.footer}
                    previewDevice={device === "mobile" ? "phone" : "desktop"}
                    pageHasHero={pageStartsWithHero(doc)}
                    chromeInert
                  >
                    <PageDocRenderer doc={doc} device={device} brand={brand} />
                  </SiteChrome>
                </SiteThemeRoot>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── shared rail bits ──────────────────────────────────────────
function Acc({
  i,
  openAcc,
  toggle,
  Icon,
  title,
  sub,
  children,
}: {
  i: number;
  openAcc: Set<number>;
  toggle: (i: number) => void;
  Icon: LucideIcon;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  const isOpen = openAcc.has(i);
  return (
    <section className={isOpen ? "bse-acc open" : "bse-acc"}>
      <button className="bse-acc-head" type="button" onClick={() => toggle(i)}>
        <span className="hic">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span>
          <span className="tt">{title}</span>
          <span className="sb">{sub}</span>
        </span>
        <ChevronDown className="chev" size={18} strokeWidth={1.9} />
      </button>
      <div className="bse-acc-body">{children}</div>
    </section>
  );
}

function Ctl({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="bse-ctl">
      <div className="bse-lbl">
        {label}
        {hint && <span className="hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Rng({
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bse-rng-row">
      <input
        className="bse-rng"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="bse-rng-val">
        {value}
        {suffix ?? ""}
      </span>
    </div>
  );
}
