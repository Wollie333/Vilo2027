import type { CSSProperties, ReactNode } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
import { SiteButton, siteImageStyle } from "./_shared";

// Free-element primitives (page-builder building blocks). Each is a small,
// self-contained, theme-aware block driven by the scoped `--site-*` vars — never
// the app's brand tokens — so it themes per tenant like every curated section.

type Align = "left" | "center" | "right";

const textAlign = (a: Align) =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
const justify = (a: Align) =>
  a === "center"
    ? "justify-center"
    : a === "right"
      ? "justify-end"
      : "justify-start";

/** Shared element wrapper — page gutters + content max-width + tight rhythm. */
function ElBlock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="px-5">
      <div className={`mx-auto max-w-5xl py-3 ${className}`}>{children}</div>
    </div>
  );
}

// ── Heading ───────────────────────────────────────────────────
type HeadingProps = Extract<WebsiteSection, { type: "el_heading" }>["props"];
const H_SIZE = {
  h2: "var(--site-h2)",
  h3: "var(--site-h3)",
  h4: "var(--site-h4)",
} as const;

export function ElHeadingSection({ props }: { props: HeadingProps }) {
  const level = props.level ?? "h2";
  const align = (props.align ?? "left") as Align;
  const style: CSSProperties = {
    fontFamily: "var(--site-font-heading)",
    fontWeight: "var(--site-weight-heading)" as unknown as number,
    fontSize: H_SIZE[level],
    lineHeight: "var(--site-leading-heading)" as unknown as number,
    letterSpacing: "var(--site-tracking-heading)",
    color: "var(--site-ink)",
  };
  const text = props.text?.trim();
  if (!text) return null;
  const Tag = level;
  return (
    <ElBlock className={textAlign(align)}>
      <Tag style={style}>{text}</Tag>
    </ElBlock>
  );
}

// ── Text ──────────────────────────────────────────────────────
type TextProps = Extract<WebsiteSection, { type: "el_text" }>["props"];

export function ElTextSection({ props }: { props: TextProps }) {
  const align = (props.align ?? "left") as Align;
  const body = props.body?.trim();
  if (!body) return null;
  return (
    <ElBlock className={textAlign(align)}>
      <p
        style={{
          color: "var(--site-mute)",
          lineHeight: "var(--site-leading-body)" as unknown as number,
        }}
        className="whitespace-pre-line text-base"
      >
        {body}
      </p>
    </ElBlock>
  );
}

// ── Image ─────────────────────────────────────────────────────
type ImageProps = Extract<WebsiteSection, { type: "el_image" }>["props"];
const IMG_MAX = { narrow: "32rem", medium: "48rem", full: "100%" } as const;

export function ElImageSection({
  props,
  asset,
  interactive,
}: {
  props: ImageProps;
  asset?: SiteAssetResolver;
  /** True on the live public site; false in the builder/preview. */
  interactive?: boolean;
}) {
  const src = asset?.(props.image_path) ?? props.image_path ?? undefined;
  if (!src) {
    // Live site shows nothing for an empty image; the builder/preview shows a
    // selectable placeholder so the host can still open it and pick an image.
    if (interactive) return null;
    return (
      <ElBlock>
        <div
          className="flex h-40 items-center justify-center rounded-[12px] border border-dashed text-sm"
          style={{ borderColor: "var(--site-line)", color: "var(--site-mute)" }}
        >
          Image
        </div>
      </ElBlock>
    );
  }
  const align = (props.align ?? "center") as Align;
  const width = props.width ?? "full";
  const img = (
    <SiteImg
      src={src}
      alt={props.alt ?? ""}
      style={siteImageStyle}
      className="h-auto w-full object-cover"
      sizes="(min-width: 768px) 768px, 100vw"
    />
  );
  return (
    <ElBlock>
      <figure
        className={`mx-auto ${align === "right" ? "ml-auto mr-0" : align === "left" ? "ml-0 mr-auto" : "mx-auto"}`}
        style={{ maxWidth: IMG_MAX[width] }}
      >
        {props.href ? (
          <a href={props.href} className="block">
            {img}
          </a>
        ) : (
          img
        )}
        {props.caption?.trim() ? (
          <figcaption
            className={`mt-2 text-sm ${textAlign(align)}`}
            style={{ color: "var(--site-mute)" }}
          >
            {props.caption}
          </figcaption>
        ) : null}
      </figure>
    </ElBlock>
  );
}

// ── Button ────────────────────────────────────────────────────
type ButtonProps = Extract<WebsiteSection, { type: "el_button" }>["props"];

export function ElButtonSection({ props }: { props: ButtonProps }) {
  const label = props.label?.trim();
  if (!label) return null;
  const align = (props.align ?? "left") as Align;
  return (
    <ElBlock>
      <div className={`flex ${justify(align)}`}>
        <SiteButton
          href={props.href || "#"}
          variant={props.variant ?? "primary"}
        >
          {label}
        </SiteButton>
      </div>
    </ElBlock>
  );
}

// ── Spacer ────────────────────────────────────────────────────
type SpacerProps = Extract<WebsiteSection, { type: "el_spacer" }>["props"];
const SPACER_H = { sm: 24, md: 48, lg: 80, xl: 128 } as const;

export function ElSpacerSection({ props }: { props: SpacerProps }) {
  return <div aria-hidden style={{ height: SPACER_H[props.size ?? "md"] }} />;
}

// ── Divider ───────────────────────────────────────────────────
type DividerProps = Extract<WebsiteSection, { type: "el_divider" }>["props"];

export function ElDividerSection({ props }: { props: DividerProps }) {
  const narrow = (props.width ?? "full") === "narrow";
  return (
    <ElBlock>
      <hr
        className={narrow ? "mx-auto w-24" : "w-full"}
        style={{
          border: "none",
          borderTop: `1px ${props.line ?? "solid"} var(--site-line)`,
        }}
      />
    </ElBlock>
  );
}
