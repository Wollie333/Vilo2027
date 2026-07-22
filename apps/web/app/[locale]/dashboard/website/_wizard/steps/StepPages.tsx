"use client";

import { ChevronDown, GripVertical } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { PageSectionsPanel } from "../PageSectionsPanel";
import { PAGE_SECTIONS } from "../pageSections";
import type { WizardPage, WizardRoom, WizardState } from "../wizardState";

// Pages step: drag to reorder (the order sets the site nav), toggle pages off,
// and a live nav preview with the auto-generated Rooms submenu. Only active rows
// are draggable; toggled-off pages stay in the list, struck through in the nav.
export function StepPages({
  state,
  rooms,
  update,
  onNext,
  onBack,
  embedded = false,
}: {
  state: WizardState;
  rooms: WizardRoom[];
  update: (patch: Partial<WizardState>) => void;
  onNext?: () => void;
  onBack?: () => void;
  /** Single-page-scroll shell: hide the step's own title + nav. */
  embedded?: boolean;
}) {
  const t = useTranslations("website");
  const [dragKind, setDragKind] = useState<string | null>(null);
  const [overKind, setOverKind] = useState<string | null>(null);
  const [pos, setPos] = useState<"before" | "after">("before");
  // Which page's section panel is expanded (accordion — one open at a time).
  const [openKind, setOpenKind] = useState<string | null>(null);

  const toggle = (kind: WizardPage["kind"]) => {
    if (kind === "home") return; // Home is the site root — always included.
    update({
      pages: state.pages.map((p) =>
        p.kind === kind ? { ...p, include: !p.include } : p,
      ),
    });
  };

  const move = (from: string, to: string, position: "before" | "after") => {
    if (from === to) return;
    const pages = [...state.pages];
    const fromIdx = pages.findIndex((p) => p.kind === from);
    if (fromIdx < 0) return;
    const [moved] = pages.splice(fromIdx, 1);
    let toIdx = pages.findIndex((p) => p.kind === to);
    if (toIdx < 0) return;
    if (position === "after") toIdx += 1;
    pages.splice(toIdx, 0, moved);
    update({ pages });
  };

  const clearDrag = () => {
    setDragKind(null);
    setOverKind(null);
  };

  let order = 0;

  return (
    <div className="space-y-5">
      {!embedded ? (
        <div>
          <h3 className="font-display text-lg font-bold text-brand-ink">
            {t("wizardPagesTitle")}
          </h3>
          <p className="mt-0.5 text-[13px] text-brand-mute">
            {t("wizardPagesBody")}
          </p>
        </div>
      ) : null}

      <ul className="overflow-hidden rounded-card border border-brand-line">
        {state.pages.map((p) => {
          const on = p.include;
          if (on) order += 1;
          const locked = p.kind === "home";
          const showIndicator = dragKind && overKind === p.kind;
          const expandable = on && (PAGE_SECTIONS[p.kind]?.length ?? 0) > 0;
          const isOpen = openKind === p.kind;
          return (
            <li
              key={p.kind}
              draggable={on}
              onDragStart={() => on && setDragKind(p.kind)}
              onDragEnd={clearDrag}
              onDragOver={(e) => {
                if (!dragKind) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setOverKind(p.kind);
                setPos(
                  e.clientY < rect.top + rect.height / 2 ? "before" : "after",
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragKind) move(dragKind, p.kind, pos);
                clearDrag();
              }}
              className={`relative border-t border-brand-line first:border-t-0 ${
                on ? "bg-white" : "bg-brand-light/30 opacity-60"
              } ${dragKind === p.kind ? "opacity-40" : ""}`}
            >
              {/* drop indicator */}
              {showIndicator ? (
                <span
                  className={`pointer-events-none absolute inset-x-0 h-0.5 bg-brand-primary ${
                    pos === "before" ? "top-0" : "bottom-0"
                  }`}
                />
              ) : null}

              <div className="flex items-center gap-3 px-3.5 py-3">
                <span
                  className={`shrink-0 ${
                    on
                      ? "cursor-grab text-brand-mute active:cursor-grabbing"
                      : "text-brand-line"
                  }`}
                  aria-hidden
                >
                  <GripVertical className="h-4 w-4" />
                </span>

                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light text-[12px] font-semibold text-brand-ink">
                  {on ? order : "—"}
                </span>

                {expandable ? (
                  <button
                    type="button"
                    onClick={() => setOpenKind(isOpen ? null : p.kind)}
                    aria-expanded={isOpen}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="flex-1 text-[14px] font-semibold text-brand-ink">
                      {t(`wizardPage_${p.kind}`)}
                      <span className="ml-2 text-[11px] font-medium text-brand-mute">
                        Edit content & images
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-brand-mute transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <span
                    className={`flex-1 text-[14px] font-semibold text-brand-ink ${
                      on ? "" : "line-through"
                    }`}
                  >
                    {t(`wizardPage_${p.kind}`)}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => toggle(p.kind)}
                  disabled={locked}
                  aria-pressed={on}
                  className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${
                    on ? "bg-brand-primary" : "bg-brand-line"
                  } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      on ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {expandable && isOpen ? (
                <PageSectionsPanel
                  pageKind={p.kind}
                  state={state}
                  update={update}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Live nav preview */}
      <NavPreview pages={state.pages} rooms={rooms} t={t} />

      {!embedded ? (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onBack}
            className="rounded-[10px] border border-brand-line px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
          >
            {t("wizardBack")}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
          >
            {t("wizardNext")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NavPreview({
  pages,
  rooms,
  t,
}: {
  pages: WizardPage[];
  rooms: WizardRoom[];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-brand-light/30 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {t("wizardNavPreview")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {pages.map((p) => {
          const isRooms = p.kind === "rooms";
          if (!p.include) {
            return (
              <span
                key={p.kind}
                className="text-[13px] text-brand-mute line-through"
              >
                {t(`wizardPage_${p.kind}`)}
              </span>
            );
          }
          return (
            <span
              key={p.kind}
              className="group relative inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand-ink"
            >
              {t(`wizardPage_${p.kind}`)}
              {isRooms && rooms.length > 0 ? (
                <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
              ) : null}
            </span>
          );
        })}
      </div>

      {/* Rooms submenu — auto-generated, one link per room */}
      {pages.find((p) => p.kind === "rooms")?.include && rooms.length > 0 ? (
        <div className="mt-2 border-t border-brand-line/70 pt-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("wizardRoomsSubmenu")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {rooms.map((r) => (
              <span
                key={r.slug}
                className="rounded-pill bg-white px-2 py-0.5 text-[11.5px] font-medium text-brand-ink ring-1 ring-brand-line"
              >
                {r.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
