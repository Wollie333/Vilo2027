import type { CSSProperties } from "react";

import { siteImageUrl } from "@/lib/site/image";
import type {
  HeroOverlay,
  HeroTextTone,
  HeroHeight,
  WebsiteSection,
} from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { HeroSearchBar } from "./HeroSearchBar";

type Props = Extract<WebsiteSection, { type: "hero" }>["props"];

// Overlay strength (dark scrim over a photo so text stays legible).
const OVERLAY_ALPHA: Record<HeroOverlay, number> = {
  none: 0,
  light: 0.25,
  medium: 0.45,
  strong: 0.65,
};
// Band height presets (min-height); "auto" uses padding only.
const HEIGHT_MINH: Record<HeroHeight, string> = {
  auto: "",
  medium: "60vh",
  tall: "78vh",
  screen: "100vh",
};

/** Overlay scrim over the hero photo. An explicit colour + opacity % wins;
 *  otherwise the `overlay` preset (a black scrim) is used. */
function overlayCss(props: Props): string | undefined {
  const hasCustom = props.overlayOpacity != null;
  const a = hasCustom
    ? Math.max(0, Math.min(100, props.overlayOpacity ?? 0)) / 100
    : OVERLAY_ALPHA[props.overlay ?? "medium"];
  if (a <= 0) return undefined;
  const color = (hasCustom && props.overlayColor?.trim()) || "#000000";
  const c = `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
  return `linear-gradient(${c},${c})`;
}

/** Decide light vs dark copy: explicit tone wins, else follow the background. */
function resolveOnDark(tone: HeroTextTone, overImage: boolean): boolean {
  if (tone === "light") return true;
  if (tone === "dark") return false;
  return overImage;
}

/** Map legacy variant values onto the current seven layouts. */
function normalizeVariant(v: Props["variant"]) {
  if (v === "classic") return "spotlight" as const;
  if (v === "split") return "split_right" as const;
  return v;
}

/** Headline + subheadline + CTA. `onDark` flips copy to white over a photo. */
function HeroInner({
  props,
  onDark,
  alignLeft,
  hideCta = false,
}: {
  props: Props;
  onDark: boolean;
  alignLeft: boolean;
  hideCta?: boolean;
}) {
  // Additive, builder-editable extras (the props already exist in the schema;
  // the generic hero simply renders them now). Each carries a stable class hook
  // (`site-hero-*`) so per-theme skins can style them without touching this
  // component or the builder's `--el-*` overrides.
  const showPrimary =
    !hideCta && props.show_cta !== false && props.cta_label && props.cta_href;
  const showSecondary =
    !hideCta &&
    props.show_cta2 !== false &&
    props.cta2_label &&
    props.cta2_href;
  return (
    <>
      {props.eyebrow ? (
        <span
          className="site-hero-eyebrow mb-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold"
          style={{
            background: onDark
              ? "rgba(255,255,255,0.16)"
              : "var(--site-accent)",
            color: onDark ? "#FFFFFF" : "var(--site-accent-ink, #FFFFFF)",
          }}
        >
          {props.eyebrow}
        </span>
      ) : null}
      <h1
        className="site-hero-title"
        style={{
          fontFamily: "var(--site-font-heading)",
          fontWeight: "var(--site-weight-heading)" as unknown as number,
          fontSize: "var(--site-h1)",
          lineHeight: "var(--site-leading-heading)" as unknown as number,
          letterSpacing: "var(--site-tracking-heading)",
          color: onDark ? "#FFFFFF" : "var(--site-ink)",
        }}
      >
        {props.headline}
      </h1>
      {props.subheadline ? (
        <p
          className="site-hero-sub mt-5 text-lg md:text-xl"
          style={{
            color: onDark ? "rgba(255,255,255,0.9)" : "var(--site-mute)",
          }}
        >
          {props.subheadline}
        </p>
      ) : null}
      {showPrimary || showSecondary ? (
        <div
          className={`site-hero-cta mt-8 flex flex-wrap gap-3 ${
            props.cta_stack ? "flex-col" : ""
          }`}
          style={{ justifyContent: alignLeft ? "flex-start" : "center" }}
        >
          {showPrimary ? (
            <a
              href={props.cta_href}
              className="site-hero-btn site-hero-btn-primary inline-flex items-center justify-center px-7 py-3.5 text-base font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "var(--site-btn-primary-bg)",
                color: "var(--site-btn-primary-color)",
                border: "var(--site-btn-primary-border)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
            >
              {props.cta_label}
            </a>
          ) : null}
          {showSecondary ? (
            <a
              href={props.cta2_href}
              className="site-hero-btn site-hero-btn-secondary inline-flex items-center justify-center px-7 py-3.5 text-base font-semibold transition-colors"
              style={{
                background: onDark ? "rgba(255,255,255,0.12)" : "transparent",
                color: onDark ? "#FFFFFF" : "var(--site-ink)",
                border: onDark
                  ? "1px solid rgba(255,255,255,0.55)"
                  : "1px solid var(--site-line)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
            >
              {props.cta2_label}
            </a>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function HeroSection({
  props,
  asset,
  interactive = false,
}: {
  props: Props;
  asset?: SiteAssetResolver;
  /** True on the live public site; false in the builder/preview. */
  interactive?: boolean;
}) {
  const variant = normalizeVariant(props.variant ?? "spotlight");
  const alignLeft = props.align === "left";
  const minHeight = HEIGHT_MINH[props.height ?? "auto"] || undefined;

  const rawBg = asset?.(props.image_path) ?? props.image_path ?? undefined;
  const bgWide = rawBg
    ? siteImageUrl(rawBg, { width: 1920, quality: 68 })
    : undefined;
  const bgSide = rawBg
    ? siteImageUrl(rawBg, { width: 1200, quality: 72 })
    : undefined;

  // ── SPLIT — text beside the image (stacks on mobile) ──────────────
  if (variant === "split_right" || variant === "split_left") {
    const onDark = resolveOnDark(props.textTone ?? "auto", false);
    const imageFirst = variant === "split_left";
    return (
      <section style={{ background: "var(--site-surface)" }}>
        <div
          className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-2 md:gap-12 md:py-20"
          style={minHeight ? { minHeight } : undefined}
        >
          <div style={{ textAlign: alignLeft ? "left" : "center" }}>
            <HeroInner props={props} onDark={onDark} alignLeft={alignLeft} />
          </div>
          {bgSide ? (
            <div
              aria-hidden
              className={`h-56 w-full md:h-[26rem] ${imageFirst ? "order-first" : "order-first md:order-last"}`}
              style={{
                backgroundImage: `url(${bgSide})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderRadius: "var(--site-img-radius)",
              }}
            />
          ) : null}
        </div>
      </section>
    );
  }

  // ── MINIMAL — no image, typographic band on the theme surface ─────
  if (variant === "minimal") {
    const onDark = resolveOnDark(props.textTone ?? "auto", false);
    return (
      <section
        style={{ background: "var(--site-surface)", minHeight }}
        className="flex items-center px-5 py-16 md:py-24"
      >
        <div
          className="mx-auto w-full max-w-3xl"
          style={{ textAlign: alignLeft ? "left" : "center" }}
        >
          <HeroInner props={props} onDark={onDark} alignLeft={alignLeft} />
        </div>
      </section>
    );
  }

  // ── BOXED — content in an elevated card over a soft background ────
  if (variant === "boxed") {
    const onDark = resolveOnDark(props.textTone ?? "auto", false);
    const bgStyle: CSSProperties = bgWide
      ? {
          backgroundImage: `${overlayCss(props) ? overlayCss(props) + "," : ""}url(${bgWide})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { background: "var(--site-accent)" };
    return (
      <section
        style={{ ...bgStyle, minHeight: minHeight ?? "60vh" }}
        className="flex items-center px-5 py-16 md:py-24"
      >
        <div
          className="mx-auto w-full max-w-2xl p-8 md:p-12"
          style={{
            background: "var(--site-surface)",
            borderRadius: "var(--site-card-radius)",
            boxShadow: "var(--site-card-shadow)",
            textAlign: alignLeft ? "left" : "center",
          }}
        >
          <HeroInner props={props} onDark={onDark} alignLeft={alignLeft} />
        </div>
      </section>
    );
  }

  // ── SPOTLIGHT / FULLSCREEN / SEARCH — full-bleed image + overlay ──
  // White hero text only makes sense OVER an image/scrim. With no image the band
  // is the theme surface (or a tone band), so we follow the inherited --site-ink
  // (dark on a light surface, white on a dark-tone band). Otherwise a blueprint's
  // textTone:"light" hero renders white-on-white whenever no photo is set — the
  // blank-hero bug seen on light themes (e.g. Marmalade / Oceans View) in preview.
  const overImage = !!rawBg;
  const onDark = overImage
    ? resolveOnDark(props.textTone ?? "auto", true)
    : false;
  const overlay = overlayCss(props);
  const bgStyle: CSSProperties = bgWide
    ? {
        backgroundImage: `${overlay ? overlay + "," : ""}url(${bgWide})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: "var(--site-surface)" };
  const isFullscreen = variant === "fullscreen";
  const isSearch = variant === "search";
  // Fullscreen anchors copy to the bottom-left; the others centre it.
  const padY = isFullscreen ? "py-20 md:py-28" : "py-24 md:py-32";
  const defaultMinH = isFullscreen ? "88vh" : isSearch ? "70vh" : undefined;

  return (
    <section
      style={{ ...bgStyle, minHeight: minHeight ?? defaultMinH }}
      className={`flex px-5 ${padY} ${isFullscreen ? "items-end" : "items-center"}`}
    >
      <div
        className={`mx-auto w-full ${isSearch ? "max-w-3xl" : "max-w-4xl"}`}
        style={{
          textAlign: isFullscreen ? "left" : alignLeft ? "left" : "center",
        }}
      >
        <HeroInner
          props={props}
          onDark={onDark}
          alignLeft={isFullscreen ? true : alignLeft}
          hideCta={isSearch}
        />
        {isSearch ? (
          <div className="mt-8">
            <HeroSearchBar
              href={props.cta_href || "/explore"}
              onDark={onDark}
              interactive={interactive}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
