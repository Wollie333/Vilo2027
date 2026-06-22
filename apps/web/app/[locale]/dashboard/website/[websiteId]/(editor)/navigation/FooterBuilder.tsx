"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { useTranslations } from "next-intl";

import type { SiteFooterColumn, SiteMenuItem } from "@/lib/site/types";

import { TextField, ToggleField } from "../pages/[pageId]/_components/fields";
import { IconBtn, PagePick, move, uid, type PageOption } from "./MenuBuilder";
import { SortableList } from "./SortableList";

export function FooterBuilder({
  columns,
  pages,
  onChange,
}: {
  columns: SiteFooterColumn[];
  pages: PageOption[];
  onChange: (columns: SiteFooterColumn[]) => void;
}) {
  const t = useTranslations("website");

  const setCol = (i: number, patch: Partial<SiteFooterColumn>) =>
    onChange(columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setLink = (i: number, li: number, patch: Partial<SiteMenuItem>) =>
    onChange(
      columns.map((c, idx) =>
        idx === i
          ? {
              ...c,
              links: c.links.map((l, ldx) =>
                ldx === li ? { ...l, ...patch } : l,
              ),
            }
          : c,
      ),
    );

  return (
    <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
      <div>
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("navFooterColsTitle")}
        </h3>
        <p className="mt-1 text-[13px] text-brand-mute">
          {t("navFooterColsDesc")}
        </p>
      </div>

      {columns.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-4 py-5 text-center text-[13px] text-brand-mute">
          {t("navFooterColsEmpty")}
        </p>
      ) : (
        <SortableList items={columns} onReorder={onChange}>
          {(col, i, handle) => (
            <div className="mb-3 rounded-card border border-brand-line p-3">
              <div className="flex items-center gap-1.5">
                {handle}
                <span className="flex-1 truncate text-sm font-semibold text-brand-ink">
                  {col.heading || t("navFooterColHeading")}
                </span>
                <IconBtn
                  onClick={() =>
                    onChange(columns.filter((_, idx) => idx !== i))
                  }
                  title={t("navRemove")}
                  danger
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>

              <div className="mt-3">
                <TextField
                  label={t("navFooterColHeading")}
                  value={col.heading ?? ""}
                  onChange={(v) => setCol(i, { heading: v })}
                  maxLength={60}
                />
              </div>

              <ul className="mt-3 space-y-2 border-l-2 border-brand-line pl-3">
                {col.links.map((l, li) => (
                  <li key={l.id}>
                    <div className="flex items-center gap-1.5">
                      <span className="flex-1 truncate text-[13px] font-medium text-brand-ink">
                        {l.label || t("navLinkLabel")}
                      </span>
                      <IconBtn
                        onClick={() =>
                          setCol(i, { links: move(col.links, li, -1) })
                        }
                        title={t("moveUp")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        onClick={() =>
                          setCol(i, { links: move(col.links, li, 1) })
                        }
                        title={t("moveDown")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        onClick={() =>
                          setCol(i, {
                            links: col.links.filter((_, ldx) => ldx !== li),
                          })
                        }
                        title={t("navRemove")}
                        danger
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <TextField
                        label={t("navLinkLabel")}
                        value={l.label}
                        onChange={(v) => setLink(i, li, { label: v })}
                        maxLength={60}
                      />
                      <TextField
                        label={t("navLinkHref")}
                        value={l.href}
                        onChange={(v) => setLink(i, li, { href: v })}
                        maxLength={500}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <PagePick
                        pages={pages}
                        onPick={(p) =>
                          setLink(i, li, {
                            href: p.href,
                            label: l.label.trim() || p.label,
                          })
                        }
                      />
                      <ToggleField
                        label={t("navLinkNewTab")}
                        checked={l.newTab ?? false}
                        onChange={(v) => setLink(i, li, { newTab: v })}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() =>
                  setCol(i, {
                    links: [...col.links, { id: uid(), label: "", href: "/" }],
                  })
                }
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-secondary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("navAddLink")}
              </button>
            </div>
          )}
        </SortableList>
      )}

      <button
        type="button"
        onClick={() =>
          onChange([...columns, { id: uid(), heading: "", links: [] }])
        }
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
      >
        <Plus className="h-4 w-4" />
        {t("navAddColumn")}
      </button>
    </section>
  );
}
