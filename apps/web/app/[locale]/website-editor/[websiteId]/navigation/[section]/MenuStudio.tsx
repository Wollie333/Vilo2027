"use client";

import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
  Type as TypeIcon,
  Palette,
  SlidersHorizontal,
  CornerDownRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useState } from "react";

import { useTranslations } from "next-intl";

import type { NavigationConfig } from "@/app/[locale]/dashboard/website/schemas";
import type { PageOption } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/MenuBuilder";
import { NavHeaderPreview } from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/navigation/NavPreviews";
import type { SiteMenuItem } from "@/lib/site/types";

type Device = "desktop" | "tablet" | "phone";
type Tab = "content" | "style" | "advanced";

// ── Pure tree helpers (path = array of sibling indices) ───────
function uid() {
  return crypto.randomUUID();
}
function newItem(): SiteMenuItem {
  return { id: uid(), label: "New link", href: "/" };
}
function editSiblings(
  menu: SiteMenuItem[],
  path: number[],
  fn: (siblings: SiteMenuItem[], idx: number) => SiteMenuItem[],
): SiteMenuItem[] {
  if (path.length === 1) return fn(menu, path[0]);
  const [i, ...rest] = path;
  return menu.map((it, idx) =>
    idx === i
      ? { ...it, children: editSiblings(it.children ?? [], rest, fn) }
      : it,
  );
}
function getAt(menu: SiteMenuItem[], path: number[]): SiteMenuItem | null {
  let list = menu;
  let node: SiteMenuItem | null = null;
  for (const i of path) {
    node = list[i] ?? null;
    if (!node) return null;
    list = node.children ?? [];
  }
  return node;
}
const samePath = (a: number[] | null, b: number[]) =>
  !!a && a.length === b.length && a.every((v, i) => v === b[i]);

export function MenuStudio({
  nav,
  setMenu,
  setMenuStyle,
  setHeader,
  pages,
  rooms = [],
  device,
  brandName,
}: {
  nav: NavigationConfig;
  setMenu: (menu: SiteMenuItem[]) => void;
  setMenuStyle: (patch: Partial<NavigationConfig["menuStyle"]>) => void;
  setHeader: (patch: Partial<NavigationConfig["header"]>) => void;
  pages: PageOption[];
  rooms?: { roomId: string; name: string }[];
  device: Device;
  brandName: string;
}) {
  const t = useTranslations("website");
  const menu = nav.menu ?? [];
  const [tab, setTab] = useState<Tab>("content");
  const [selected, setSelected] = useState<number[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const selectedItem = selected ? getAt(menu, selected) : null;

  const update = (path: number[], patch: Partial<SiteMenuItem>) =>
    setMenu(
      editSiblings(menu, path, (sib, idx) =>
        sib.map((it, k) => (k === idx ? { ...it, ...patch } : it)),
      ),
    );
  const remove = (path: number[]) => {
    setMenu(
      editSiblings(menu, path, (sib, idx) => sib.filter((_, k) => k !== idx)),
    );
    if (samePath(selected, path)) setSelected(null);
  };
  const move = (path: number[], dir: -1 | 1) =>
    setMenu(
      editSiblings(menu, path, (sib, idx) => {
        const j = idx + dir;
        if (j < 0 || j >= sib.length) return sib;
        const n = sib.slice();
        [n[idx], n[j]] = [n[j], n[idx]];
        return n;
      }),
    );
  const addChild = (path: number[]) => {
    const item = getAt(menu, path);
    setMenu(
      editSiblings(menu, path, (sib, idx) =>
        sib.map((it, k) =>
          k === idx
            ? { ...it, children: [...(it.children ?? []), newItem()] }
            : it,
        ),
      ),
    );
    setOpen((p) => ({ ...p, [item?.id ?? ""]: true }));
  };
  const addTop = (item?: SiteMenuItem) => setMenu([...menu, item ?? newItem()]);

  // ── Recursive tree row ──
  function Rows({ items, base }: { items: SiteMenuItem[]; base: number[] }) {
    return (
      <>
        {items.map((item, i) => {
          const path = [...base, i];
          const depth = path.length - 1;
          const hasKids = !!item.children && item.children.length > 0;
          // Auto-rooms items list the site's live rooms as (read-only) child
          // tabs right here in the tree, so the host sees what the dropdown holds.
          const hasAutoRooms = !!item.autoRooms && rooms.length > 0;
          const expandable = hasKids || hasAutoRooms;
          const isOpen = open[item.id] ?? true;
          const isSel = samePath(selected, path);
          return (
            <div key={item.id}>
              <div
                className={`group flex items-center gap-1 rounded-[8px] px-1.5 py-1.5 ${
                  isSel ? "bg-brand-light" : "hover:bg-brand-light/50"
                }`}
                style={{ marginLeft: depth * 16 }}
              >
                {expandable ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpen((p) => ({ ...p, [item.id]: !isOpen }))
                    }
                    className="text-brand-mute"
                    aria-label="Toggle"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <GripVertical className="h-3.5 w-3.5 text-brand-line" />
                )}
                <button
                  type="button"
                  onClick={() => setSelected(path)}
                  className="flex flex-1 items-center gap-1.5 truncate text-left text-[13px] font-medium text-brand-ink"
                >
                  <span className="truncate">
                    {item.label || t("navLinkLabel")}
                  </span>
                  {item.autoRooms ? (
                    <span className="shrink-0 rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-secondary">
                      {t("menuAutoRoomsBadge")}
                    </span>
                  ) : null}
                </button>
                <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  {depth < 2 && !item.autoRooms ? (
                    <IconBtn
                      title={t("navAddChild")}
                      onClick={() => addChild(path)}
                    >
                      <CornerDownRight className="h-3.5 w-3.5" />
                    </IconBtn>
                  ) : null}
                  <IconBtn title="Up" onClick={() => move(path, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn title="Down" onClick={() => move(path, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn
                    title={t("mediaDelete")}
                    danger
                    onClick={() => remove(path)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              </div>
              {item.autoRooms ? (
                hasAutoRooms && isOpen ? (
                  rooms.map((r) => {
                    const isHidden = (item.hiddenRoomIds ?? []).includes(
                      r.roomId,
                    );
                    return (
                      <div
                        key={r.roomId}
                        className="group flex items-center gap-1 rounded-[8px] px-1.5 py-1 hover:bg-brand-light/40"
                        style={{ marginLeft: (depth + 1) * 16 }}
                      >
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-brand-line" />
                        <button
                          type="button"
                          onClick={() => setSelected(path)}
                          className={`flex-1 truncate text-left text-[12.5px] ${
                            isHidden
                              ? "text-brand-mute line-through"
                              : "text-brand-ink"
                          }`}
                        >
                          {r.name}
                        </button>
                        <IconBtn
                          title={
                            isHidden
                              ? t("menuAutoRoomShow")
                              : t("menuAutoRoomHide")
                          }
                          onClick={() => {
                            const set = new Set(item.hiddenRoomIds ?? []);
                            if (isHidden) set.delete(r.roomId);
                            else set.add(r.roomId);
                            update(path, { hiddenRoomIds: [...set] });
                          }}
                        >
                          {isHidden ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </IconBtn>
                      </div>
                    );
                  })
                ) : null
              ) : hasKids && isOpen ? (
                <Rows items={item.children ?? []} base={path} />
              ) : null}
            </div>
          );
        })}
      </>
    );
  }

  const ms = nav.menuStyle ?? {};

  return (
    <>
      {/* LEFT — tabbed builder */}
      <aside className="epanel l" style={{ width: 320 }}>
        <div
          role="tablist"
          className="m-3 grid grid-cols-3 overflow-hidden rounded-[10px] border border-brand-line"
        >
          {(
            [
              ["content", t("menuTabContent"), TypeIcon],
              ["style", t("menuTabStyle"), Palette],
              ["advanced", t("menuTabAdvanced"), SlidersHorizontal],
            ] as const
          ).map(([key, label, Ico]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 text-[12.5px] font-semibold transition ${
                tab === key
                  ? "bg-brand-primary text-white"
                  : "bg-white text-brand-mute hover:bg-brand-light"
              }`}
            >
              <Ico style={{ width: 14, height: 14 }} />
              {label}
            </button>
          ))}
        </div>

        <div className="epanel-b thin" style={{ paddingTop: 0 }}>
          {tab === "content" ? (
            <div className="insp-sec">
              <div className="px-1.5 pb-2">
                <Rows items={menu} base={[]} />
              </div>
              <button
                type="button"
                onClick={() => addTop()}
                className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-secondary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("navAddLink")}
              </button>
              {pages.length > 0 ? (
                <div className="mt-3">
                  <span className="block text-[11.5px] font-semibold text-brand-mute">
                    {t("menuAddFromPage")}
                  </span>
                  <select
                    value=""
                    onChange={(e) => {
                      const p = pages.find((x) => x.href === e.target.value);
                      if (p)
                        addTop({ id: uid(), label: p.label, href: p.href });
                      e.target.value = "";
                    }}
                    className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                  >
                    <option value="">{t("menuPickPage")}</option>
                    {pages.map((p) => (
                      <option key={p.href} value={p.href}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : tab === "style" ? (
            <div className="insp-sec space-y-3">
              <ColorField
                label={t("menuStyleColor")}
                value={ms.color ?? ""}
                onChange={(v) => setMenuStyle({ color: v })}
              />
              <ColorField
                label={t("menuStyleHover")}
                value={ms.hoverColor ?? ""}
                onChange={(v) => setMenuStyle({ hoverColor: v })}
              />
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  {t("menuStyleWeight")}
                </span>
                <select
                  value={ms.weight ?? "medium"}
                  onChange={(e) =>
                    setMenuStyle({
                      weight: e.target.value as NonNullable<
                        NavigationConfig["menuStyle"]
                      >["weight"],
                    })
                  }
                  className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                >
                  <option value="normal">{t("menuWeightNormal")}</option>
                  <option value="medium">{t("menuWeightMedium")}</option>
                  <option value="semibold">{t("menuWeightSemibold")}</option>
                  <option value="bold">{t("menuWeightBold")}</option>
                </select>
              </label>
              <CheckRow
                label={t("menuStyleUppercase")}
                checked={ms.uppercase ?? false}
                onChange={(v) => setMenuStyle({ uppercase: v })}
              />
            </div>
          ) : (
            <div className="insp-sec space-y-3">
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  {t("menuAlignLabel")}
                </span>
                <select
                  value={ms.align ?? "start"}
                  onChange={(e) =>
                    setMenuStyle({
                      align: e.target.value as "start" | "center" | "end",
                    })
                  }
                  className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                >
                  <option value="start">{t("menuAlign_start")}</option>
                  <option value="center">{t("menuAlign_center")}</option>
                  <option value="end">{t("menuAlign_end")}</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  {t("navMenuCollapse")}
                </span>
                <select
                  value={nav.header.menuCollapse ?? "mobile"}
                  onChange={(e) =>
                    setHeader({
                      menuCollapse: e.target.value as
                        | "mobile"
                        | "tablet"
                        | "never",
                    })
                  }
                  className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                >
                  <option value="mobile">{t("navCollapseMobile")}</option>
                  <option value="tablet">{t("navCollapseTablet")}</option>
                  <option value="never">{t("navCollapseNever")}</option>
                </select>
              </label>
              <p className="text-[11.5px] text-brand-mute">
                {t("menuBookInHeaderHint")}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* CENTER — live preview */}
      <div className="canvas-wrap thin">
        <div
          className={
            device === "tablet"
              ? "device tablet"
              : device === "phone"
                ? "device mobile"
                : "device"
          }
        >
          <div className="vilo-nav">
            <NavHeaderPreview nav={nav} brandName={brandName} device={device} />
          </div>
        </div>
      </div>

      {/* RIGHT — selected link inspector */}
      <aside className="epanel r" style={{ width: 312 }}>
        <div className="epanel-h">
          <TypeIcon style={{ width: 16, height: 16, color: "#10B981" }} />
          <h3>{t("menuSelectedLink")}</h3>
        </div>
        <div className="epanel-b thin">
          {selectedItem && selected ? (
            <div className="insp-sec space-y-3">
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  {t("navLinkLabel")}
                </span>
                <input
                  type="text"
                  value={selectedItem.label}
                  maxLength={60}
                  onChange={(e) => update(selected, { label: e.target.value })}
                  className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                />
              </label>
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  {t("navLinkHref")}
                </span>
                <input
                  type="text"
                  value={selectedItem.href}
                  maxLength={500}
                  onChange={(e) => update(selected, { href: e.target.value })}
                  className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                />
              </label>
              {pages.length > 0 ? (
                <label className="block">
                  <span className="block text-[12.5px] font-semibold text-brand-ink">
                    {t("menuLinkToPage")}
                  </span>
                  <select
                    value=""
                    onChange={(e) => {
                      const p = pages.find((x) => x.href === e.target.value);
                      if (p) update(selected, { href: p.href });
                      e.target.value = "";
                    }}
                    className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
                  >
                    <option value="">{t("menuPickPage")}</option>
                    {pages.map((p) => (
                      <option key={p.href} value={p.href}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <CheckRow
                label={t("navLinkNewTab")}
                checked={selectedItem.newTab ?? false}
                onChange={(v) => update(selected, { newTab: v })}
              />

              {/* Auto-rooms: turn this item's dropdown into the live room list. */}
              <div className="space-y-2 rounded-[10px] border border-brand-line p-2.5">
                <CheckRow
                  label={t("menuAutoRoomsToggle")}
                  checked={!!selectedItem.autoRooms}
                  onChange={(v) => {
                    update(selected, {
                      autoRooms: v,
                      hiddenRoomIds: v
                        ? (selectedItem.hiddenRoomIds ?? [])
                        : undefined,
                    });
                    // Expand the item so its rooms populate in the tree at once.
                    if (v) setOpen((p) => ({ ...p, [selectedItem.id]: true }));
                  }}
                />
                {selectedItem.autoRooms ? (
                  rooms.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="block text-[11.5px] text-brand-mute">
                        {t("menuAutoRoomsHint")}
                      </span>
                      {rooms.map((r) => {
                        const hidden = (
                          selectedItem.hiddenRoomIds ?? []
                        ).includes(r.roomId);
                        return (
                          <CheckRow
                            key={r.roomId}
                            label={r.name}
                            checked={!hidden}
                            onChange={(show) => {
                              const set = new Set(
                                selectedItem.hiddenRoomIds ?? [],
                              );
                              if (show) set.delete(r.roomId);
                              else set.add(r.roomId);
                              update(selected, { hiddenRoomIds: [...set] });
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <span className="block text-[11.5px] text-brand-mute">
                      {t("menuAutoRoomsEmpty")}
                    </span>
                  )
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => remove(selected)}
                className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {t("navDeleteLink")}
              </button>
            </div>
          ) : (
            <div className="insp-sec">
              <p className="text-[12.5px] text-brand-mute">
                {t("menuSelectHint")}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-1 transition ${
        danger
          ? "text-brand-mute hover:bg-white hover:text-red-600"
          : "text-brand-mute hover:bg-white hover:text-brand-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold text-brand-ink">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value || "#0f172a"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-brand-line bg-white"
        />
        <input
          type="text"
          value={value}
          placeholder="theme default"
          maxLength={40}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-[11.5px] font-medium text-brand-mute hover:text-brand-ink"
          >
            ✕
          </button>
        ) : null}
      </div>
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-brand-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
      />
      {label}
    </label>
  );
}
