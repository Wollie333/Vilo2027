"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { useTranslations } from "next-intl";

import type { SiteMenuItem } from "@/lib/site/types";

import { TextField, ToggleField } from "../pages/[pageId]/_components/fields";

export type PageOption = { label: string; href: string };

export const uid = () => crypto.randomUUID();

export function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Quick page picker — sets a link's href (and label, if blank) from a page. */
export function PagePick({
  pages,
  onPick,
}: {
  pages: PageOption[];
  onPick: (page: PageOption) => void;
}) {
  const t = useTranslations("website");
  if (pages.length === 0) return null;
  return (
    <select
      value=""
      onChange={(e) => {
        const p = pages.find((x) => x.href === e.target.value);
        if (p) onPick(p);
      }}
      className="rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[12px] text-brand-mute outline-none focus:border-brand-primary"
    >
      <option value="">{t("navLinkPage")}</option>
      {pages.map((p) => (
        <option key={p.href} value={p.href}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

export function IconBtn({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 text-brand-mute hover:bg-brand-light ${
        danger ? "hover:text-red-600" : "hover:text-brand-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function MenuBuilder({
  menu,
  pages,
  onChange,
}: {
  menu: SiteMenuItem[];
  pages: PageOption[];
  onChange: (menu: SiteMenuItem[]) => void;
}) {
  const t = useTranslations("website");

  const setItem = (i: number, patch: Partial<SiteMenuItem>) =>
    onChange(menu.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const setChild = (i: number, ci: number, patch: Partial<SiteMenuItem>) =>
    onChange(
      menu.map((it, idx) =>
        idx === i
          ? {
              ...it,
              children: (it.children ?? []).map((c, cdx) =>
                cdx === ci ? { ...c, ...patch } : c,
              ),
            }
          : it,
      ),
    );

  return (
    <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("navMenuTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">{t("navMenuDesc")}</p>
        </div>
        {pages.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              onChange(
                pages.map((p) => ({ id: uid(), label: p.label, href: p.href })),
              )
            }
            className="shrink-0 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            {t("navMenuBuild")}
          </button>
        ) : null}
      </div>

      {menu.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-4 py-5 text-center text-[13px] text-brand-mute">
          {t("navMenuEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {menu.map((item, i) => (
            <li
              key={item.id}
              className="rounded-card border border-brand-line p-3"
            >
              <div className="flex items-center gap-1.5">
                <span className="flex-1 truncate text-sm font-semibold text-brand-ink">
                  {item.label || t("navLinkLabel")}
                </span>
                <IconBtn
                  onClick={() => onChange(move(menu, i, -1))}
                  title={t("moveUp")}
                >
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  onClick={() => onChange(move(menu, i, 1))}
                  title={t("moveDown")}
                >
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  onClick={() => onChange(menu.filter((_, idx) => idx !== i))}
                  title={t("navRemove")}
                  danger
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField
                  label={t("navLinkLabel")}
                  value={item.label}
                  onChange={(v) => setItem(i, { label: v })}
                  maxLength={60}
                />
                <TextField
                  label={t("navLinkHref")}
                  value={item.href}
                  onChange={(v) => setItem(i, { href: v })}
                  maxLength={500}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <PagePick
                  pages={pages}
                  onPick={(p) =>
                    setItem(i, {
                      href: p.href,
                      label: item.label.trim() || p.label,
                    })
                  }
                />
                <ToggleField
                  label={t("navLinkNewTab")}
                  checked={item.newTab ?? false}
                  onChange={(v) => setItem(i, { newTab: v })}
                />
              </div>

              {/* Dropdown children */}
              {(item.children ?? []).length > 0 ? (
                <ul className="mt-3 space-y-2 border-l-2 border-brand-line pl-3">
                  {(item.children ?? []).map((child, ci) => (
                    <li key={child.id}>
                      <div className="flex items-center gap-1.5">
                        <span className="flex-1 truncate text-[13px] font-medium text-brand-ink">
                          {child.label || t("navLinkLabel")}
                        </span>
                        <IconBtn
                          onClick={() =>
                            setItem(i, {
                              children: move(item.children ?? [], ci, -1),
                            })
                          }
                          title={t("moveUp")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          onClick={() =>
                            setItem(i, {
                              children: move(item.children ?? [], ci, 1),
                            })
                          }
                          title={t("moveDown")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          onClick={() =>
                            setItem(i, {
                              children: (item.children ?? []).filter(
                                (_, cdx) => cdx !== ci,
                              ),
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
                          value={child.label}
                          onChange={(v) => setChild(i, ci, { label: v })}
                          maxLength={60}
                        />
                        <TextField
                          label={t("navLinkHref")}
                          value={child.href}
                          onChange={(v) => setChild(i, ci, { href: v })}
                          maxLength={500}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <PagePick
                          pages={pages}
                          onPick={(p) =>
                            setChild(i, ci, {
                              href: p.href,
                              label: child.label.trim() || p.label,
                            })
                          }
                        />
                        <ToggleField
                          label={t("navLinkNewTab")}
                          checked={child.newTab ?? false}
                          onChange={(v) => setChild(i, ci, { newTab: v })}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  setItem(i, {
                    children: [
                      ...(item.children ?? []),
                      { id: uid(), label: "", href: "/" },
                    ],
                  })
                }
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-secondary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("navAddChild")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onChange([...menu, { id: uid(), label: "", href: "/" }])}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
      >
        <Plus className="h-4 w-4" />
        {t("navAddLink")}
      </button>
    </section>
  );
}
