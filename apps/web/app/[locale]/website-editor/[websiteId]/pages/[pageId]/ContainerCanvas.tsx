"use client";

import {
  ArrowDown,
  ArrowUp,
  Heading,
  Image as ImageIcon,
  Pilcrow,
  SquareMousePointer,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

import { useTranslations } from "next-intl";

import { newColumnBlock } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/pages/[pageId]/_components/SectionEditor";
import { InlineBlock } from "@/components/site/sections/ColumnsSection";
import type { SiteAssetResolver } from "@/lib/site/types";
import type {
  ColumnBlock,
  ColumnBlockKind,
  WebsiteSection,
} from "@/lib/website/sections.schema";

// Builder-only canvas for the "Section" (flex) container: renders each child
// element with selectable chrome and an inline element picker, so the host
// places + arranges elements ON the canvas (mirrors the page builder's block
// chrome). The live site keeps rendering the public FlexSection — this path is
// only used inside the editor. Children reuse the column-block primitives.

type FlexSection = Extract<WebsiteSection, { type: "flex" }>;

const JUSTIFY: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};
const ALIGN: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};
const GAP_PX: Record<string, number> = { sm: 16, md: 32, lg: 48 };

const ADD_KINDS: Array<{ kind: ColumnBlockKind; Icon: LucideIcon }> = [
  { kind: "heading", Icon: Heading },
  { kind: "text", Icon: Pilcrow },
  { kind: "image", Icon: ImageIcon },
  { kind: "button", Icon: SquareMousePointer },
];

/** A block with no content yet — show a placeholder instead of an empty box. */
function isBlockEmpty(b: ColumnBlock): boolean {
  switch (b.kind) {
    case "heading":
      return !b.text?.trim();
    case "text":
      return !b.body?.trim();
    case "image":
      return !b.image_path;
    case "button":
      return !b.label?.trim();
    default:
      return false;
  }
}

export function ContainerCanvas({
  section,
  asset,
  selectedIndex,
  onSelectChild,
  onChange,
}: {
  section: FlexSection;
  asset?: SiteAssetResolver;
  selectedIndex: number | null;
  onSelectChild: (index: number | null) => void;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");
  const p = section.props;
  const blocks = p.blocks ?? [];

  const setBlocks = (next: ColumnBlock[]) =>
    onChange({ ...section, props: { ...p, blocks: next } });
  const add = (kind: ColumnBlockKind) => {
    onSelectChild(blocks.length);
    setBlocks([...blocks, newColumnBlock(kind)]);
  };
  const del = (i: number) => {
    onSelectChild(null);
    setBlocks(blocks.filter((_, j) => j !== i));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onSelectChild(j);
    setBlocks(next);
  };

  const addBar = (
    <div className="cc-add" onClick={(e) => e.stopPropagation()}>
      <span className="cc-add-label">{t("ccAddElement")}</span>
      {ADD_KINDS.map(({ kind, Icon }) => (
        <button
          key={kind}
          type="button"
          className="cc-add-btn"
          onClick={(e) => {
            e.stopPropagation();
            add(kind);
          }}
        >
          <Icon style={{ width: 13, height: 13 }} />
          {t(`blockKind_${kind}`)}
        </button>
      ))}
    </div>
  );

  if (blocks.length === 0) {
    return (
      <div className="cc-empty" onClick={(e) => e.stopPropagation()}>
        <p className="cc-empty-t">{t("ccEmpty")}</p>
        {addBar}
      </div>
    );
  }

  const flexStyle: CSSProperties = {
    display: "flex",
    flexDirection: p.direction === "column" ? "column" : "row",
    justifyContent: JUSTIFY[p.justify ?? "start"],
    alignItems: ALIGN[p.align ?? "stretch"],
    gap: `${GAP_PX[p.gap ?? "md"]}px`,
    flexWrap: p.wrap === false ? "nowrap" : "wrap",
  };

  return (
    <div className="cc-wrap">
      <div style={flexStyle}>
        {blocks.map((b, i) => (
          <div
            key={i}
            className={["cc-block", selectedIndex === i ? "sel" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              onSelectChild(i);
            }}
          >
            <span className="cc-block-label">{t(`blockKind_${b.kind}`)}</span>
            <div className="cc-block-tools">
              <button
                type="button"
                disabled={i === 0}
                title={t("moveUp")}
                onClick={(e) => {
                  e.stopPropagation();
                  move(i, -1);
                }}
              >
                <ArrowUp style={{ width: 13, height: 13 }} />
              </button>
              <button
                type="button"
                disabled={i === blocks.length - 1}
                title={t("moveDown")}
                onClick={(e) => {
                  e.stopPropagation();
                  move(i, 1);
                }}
              >
                <ArrowDown style={{ width: 13, height: 13 }} />
              </button>
              <button
                type="button"
                className="del"
                title={t("deleteSection")}
                onClick={(e) => {
                  e.stopPropagation();
                  del(i);
                }}
              >
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
            {isBlockEmpty(b) ? (
              <div className="cc-ph">{t(`blockKind_${b.kind}`)}</div>
            ) : (
              <InlineBlock block={b} asset={asset} />
            )}
          </div>
        ))}
      </div>
      {addBar}
    </div>
  );
}
