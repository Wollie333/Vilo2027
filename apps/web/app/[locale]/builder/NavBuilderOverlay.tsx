"use client";

import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Menu as MenuIcon,
  RotateCcw,
  Check,
  Save,
  Monitor,
  Smartphone,
  Lock,
  GripVertical,
  Trash2,
  Plus,
} from "lucide-react";

import type { SiteMenuItem } from "@/lib/site/types";
import type { SiteThemeConfig } from "@/lib/site/themes";
import type { Brand } from "./BrandStudioOverlay";

// Builder V2 — Phase 4d-1: Nav/Menu builder overlay (link builder + preview).
//
// Reskins the LOCKED nav standard into the `.bse-*` overlay while keeping the
// real `SiteNavigation` JSONB as SSOT. This slice edits the TOP-LEVEL menu
// (rename / reorder / add / delete / quick-add-page) — each item's internals
// (children, autoRooms, hiddenOnPages, style, newTab) are preserved untouched,
// so nothing is lost on save. Per-device style rail, nesting, header/footer and
// per-page controls land in 4d-2+. Persistence via `saveNavigationAction`.

type PageOpt = { key: string; label: string; href: string };

export function NavBuilderOverlay({
  open,
  onClose,
  siteLabel,
  domain,
  menu,
  onMenuChange,
  pages,
  brand,
  theme,
  persists,
  onSave,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  siteLabel: string;
  domain: string;
  menu: SiteMenuItem[];
  onMenuChange: (next: SiteMenuItem[]) => void;
  pages: PageOpt[];
  brand: Brand;
  theme: SiteThemeConfig;
  persists: boolean;
  onSave: (mode: "draft" | "publish") => void;
  onReset: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pubOpen, setPubOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const idRef = useRef(0);
  const newId = () => `nav-${Date.now().toString(36)}-${++idRef.current}`;

  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const rename = (i: number, label: string) =>
    onMenuChange(menu.map((m, j) => (j === i ? { ...m, label } : m)));
  const remove = (i: number) => onMenuChange(menu.filter((_, j) => j !== i));
  const add = (label: string, href: string) => {
    const l = label.trim();
    if (!l) return;
    onMenuChange([...menu, { id: newId(), label: l, href }]);
  };
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...menu];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onMenuChange(next);
  };

  const monogram = (brand.monogram || brand.name?.[0] || "W").slice(0, 2);
  const name = brand.name || siteLabel;

  const cls = ["bse-overlay", open && "show", open && "in"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} aria-hidden={!open}>
      <header className="bse-top">
        <button className="bse-back" type="button" onClick={onClose}>
          <ChevronLeft size={16} strokeWidth={2} />
          Back to builder
        </button>
        <div className="bse-div" />
        <div className="bse-title">
          <span className="bse-mark">
            <MenuIcon size={16} strokeWidth={1.9} />
          </span>
          <div>
            <b>Navigation</b>
            <small>Menu · {siteLabel}</small>
          </div>
        </div>
        <div className="bse-spacer" />
        <button
          className="tb-ico"
          type="button"
          title="Reset navigation to the default menu"
          style={{ color: "#BFE3D3" }}
          onClick={onReset}
        >
          <RotateCcw size={18} strokeWidth={1.9} />
        </button>
        <div className="tb-publish">
          <button
            className="tb-btn solid"
            type="button"
            onClick={() => onSave("publish")}
            disabled={!persists}
            title={persists ? "Save the menu" : "Open a real page to save"}
          >
            <Check size={16} strokeWidth={2} />
            Save menu
          </button>
          <button
            className="tb-caret"
            type="button"
            title="Save options"
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
                onSave("draft");
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
                onSave("publish");
              }}
            >
              <span className="mi">
                <Check size={16} strokeWidth={1.9} />
              </span>
              <span>
                <b>Publish navigation</b>
                <small>Apply across every page</small>
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="bse-body">
        {/* link builder */}
        <aside className="nav-left">
          <div className="nav-left-body">
            <div className="nav-lbl">Links · drag to reorder</div>
            <div className="nav-links">
              {menu.map((it, i) => (
                <div
                  key={it.id}
                  className={dragOver === i ? "nav-link drag-over" : "nav-link"}
                  draggable
                  onDragStart={() => {
                    dragIdx.current = i;
                  }}
                  onDragEnd={() => {
                    dragIdx.current = null;
                    setDragOver(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx.current != null) reorder(dragIdx.current, i);
                    setDragOver(null);
                  }}
                >
                  <span className="grip" title="Drag to reorder">
                    <GripVertical size={14} strokeWidth={2} />
                  </span>
                  <input
                    className="lk"
                    value={it.label}
                    onChange={(e) => rename(i, e.target.value)}
                  />
                  {it.children && it.children.length > 0 && (
                    <span className="drop-badge">menu</span>
                  )}
                  {it.autoRooms && <span className="drop-badge">rooms</span>}
                  <button
                    className="lact del"
                    type="button"
                    title="Delete"
                    onClick={() => remove(i)}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
              {menu.length === 0 && (
                <div className="hint">
                  No links yet. Add one below or quick-add a page.
                </div>
              )}
            </div>

            <div className="nav-add">
              <input
                value={addLabel}
                placeholder="New link label…"
                onChange={(e) => setAddLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    add(addLabel, "#");
                    setAddLabel("");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  add(addLabel, "#");
                  setAddLabel("");
                }}
              >
                <Plus size={15} strokeWidth={2} />
                Add
              </button>
            </div>

            <div className="nav-quick">
              <div className="nav-lbl" style={{ marginTop: 16 }}>
                Quick-add a page
              </div>
              <select
                className="bse-select"
                value=""
                onChange={(e) => {
                  const p = pages.find((x) => x.key === e.target.value);
                  if (p) add(p.label, p.href);
                }}
              >
                <option value="">Choose a page…</option>
                {pages.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* live header preview */}
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
              <div
                className="nav-site"
                style={
                  {
                    "--site-accent":
                      theme.colors?.accent || theme.base?.palette.accent,
                    "--site-ink": theme.base?.palette.ink,
                  } as React.CSSProperties
                }
              >
                <div className="np-hero">
                  <div className="np-bar">
                    <div className="np-logo">
                      <span className="mk">{monogram}</span>
                      <span className="lname">{name}</span>
                    </div>
                    {device === "desktop" && (
                      <nav className="np-nav">
                        {menu.map((it, i) => (
                          <span
                            key={it.id}
                            className={i === 0 ? "nl active" : "nl"}
                          >
                            {it.label}
                            {it.children && it.children.length > 0 && (
                              <ChevronDown
                                className="cx"
                                size={13}
                                strokeWidth={2.2}
                              />
                            )}
                          </span>
                        ))}
                        <span className="np-reserve">Reserve</span>
                      </nav>
                    )}
                    {device === "mobile" && (
                      <span
                        className="np-reserve"
                        style={{ marginLeft: "auto" }}
                      >
                        <MenuIcon size={18} strokeWidth={2} />
                      </span>
                    )}
                  </div>
                  <div className="np-eyebrow">{siteLabel} · Book direct</div>
                  <div className="np-title">Your stay, your way</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
