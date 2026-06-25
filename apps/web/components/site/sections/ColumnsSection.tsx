import type { CSSProperties } from "react";

import type {
  ColumnBlock,
  WebsiteSection,
} from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
import {
  SectionHeading,
  SectionShell,
  SiteButton,
  siteImageStyle,
} from "./_shared";

type Props = Extract<WebsiteSection, { type: "columns" }>["props"];

const H_SIZE = {
  h1: "var(--site-h1, 2.5rem)",
  h2: "var(--site-h2)",
  h3: "var(--site-h3)",
  h4: "var(--site-h4)",
  h5: "1.25rem",
  h6: "1.05rem",
  p: "1rem",
} as const;

/** One inline block inside a column. Theme-aware via the scoped `--site-*` vars. */
export function InlineBlock({
  block,
  asset,
}: {
  block: ColumnBlock;
  asset?: SiteAssetResolver;
}) {
  switch (block.kind) {
    case "heading": {
      const level = block.level ?? "h3";
      const style: CSSProperties = {
        fontFamily: "var(--site-font-heading)",
        fontWeight: "var(--site-weight-heading)" as unknown as number,
        fontSize: H_SIZE[level],
        lineHeight: "var(--site-leading-heading)" as unknown as number,
        letterSpacing: "var(--site-tracking-heading)",
        color: "var(--site-ink)",
      };
      const Tag = level;
      return block.text?.trim() ? <Tag style={style}>{block.text}</Tag> : null;
    }
    case "text":
      return block.body?.trim() ? (
        <p
          style={{
            color: "var(--site-mute)",
            lineHeight: "var(--site-leading-body)" as unknown as number,
          }}
          className="whitespace-pre-line text-base"
        >
          {block.body}
        </p>
      ) : null;
    case "image": {
      const src = asset?.(block.image_path) ?? block.image_path ?? undefined;
      if (!src) return null;
      return (
        <SiteImg
          src={src}
          alt={block.alt ?? ""}
          style={siteImageStyle}
          className="h-auto w-full object-cover"
          sizes="(min-width: 768px) 360px, 100vw"
          widths={[240, 360, 480, 720]}
        />
      );
    }
    case "button":
      return block.label?.trim() ? (
        <div>
          <SiteButton
            href={block.href || "#"}
            variant={block.variant ?? "primary"}
          >
            {block.label}
          </SiteButton>
        </div>
      ) : null;
    default:
      return null;
  }
}

const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};
const GAP: Record<string, string> = {
  sm: "gap-4",
  md: "gap-8",
  lg: "gap-12",
};

export function ColumnsSection({
  props,
  asset,
}: {
  props: Props;
  asset?: SiteAssetResolver;
}) {
  const cols = props.columns ?? [];
  if (cols.length === 0) return null;
  const count = Math.min(4, Math.max(1, cols.length));
  const centered = props.align === "center";

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className={`grid ${COLS[count]} ${GAP[props.gap ?? "md"]}`}>
        {cols.map((col, i) => (
          <div
            key={i}
            className={`flex flex-col gap-4 ${
              centered ? "items-center text-center" : ""
            }`}
          >
            {col.blocks.map((b, j) => (
              <InlineBlock key={j} block={b} asset={asset} />
            ))}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ── Flex container ────────────────────────────────────────────
type FlexProps = Extract<WebsiteSection, { type: "flex" }>["props"];
const FLEX_JUSTIFY_CSS = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
} as const;
const FLEX_ALIGN_CSS = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
} as const;
const FLEX_GAP_PX = { sm: 16, md: 32, lg: 48 } as const;

/** Free-form flex container — the host arranges blocks with flexbox to build
 *  their own row/stack layout. Children reuse the column block primitives. */
export function FlexSection({
  props,
  asset,
}: {
  props: FlexProps;
  asset?: SiteAssetResolver;
}) {
  const blocks = props.blocks ?? [];
  if (blocks.length === 0) return null;
  return (
    <SectionShell>
      <div
        style={{
          display: "flex",
          flexDirection: props.direction === "column" ? "column" : "row",
          justifyContent: FLEX_JUSTIFY_CSS[props.justify ?? "start"],
          alignItems: FLEX_ALIGN_CSS[props.align ?? "stretch"],
          gap: `${FLEX_GAP_PX[props.gap ?? "md"]}px`,
          flexWrap: props.wrap === false ? "nowrap" : "wrap",
        }}
      >
        {blocks.map((b, i) => (
          <div key={i}>
            <InlineBlock block={b} asset={asset} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
