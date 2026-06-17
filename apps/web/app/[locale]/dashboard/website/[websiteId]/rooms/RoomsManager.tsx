"use client";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  saveWebsiteRoomsAction,
  syncWebsiteRoomsAction,
} from "@/app/[locale]/dashboard/website/actions";

import type { RoomEditorRow, RoomsEditorProperty } from "./loadRoomsEditor";
import {
  TextArea,
  TextField,
  ToggleField,
} from "../pages/[pageId]/_components/fields";

export function RoomsManager({
  websiteId,
  initialProperties,
}: {
  websiteId: string;
  initialProperties: RoomsEditorProperty[];
}) {
  const t = useTranslations("website");
  const router = useRouter();

  const [properties, setProperties] =
    useState<RoomsEditorProperty[]>(initialProperties);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, startSave] = useTransition();
  const [syncing, startSync] = useTransition();

  const initialJson = useMemo(
    () => JSON.stringify(initialProperties),
    [initialProperties],
  );
  const dirty = JSON.stringify(properties) !== initialJson;

  const { shown, total } = useMemo(() => {
    let s = 0;
    let n = 0;
    for (const p of properties)
      for (const r of p.rooms) {
        n += 1;
        if (r.isVisible) s += 1;
      }
    return { shown: s, total: n };
  }, [properties]);

  function patchRoom(
    propertyId: string,
    roomId: string,
    next: Partial<RoomEditorRow>,
  ) {
    setProperties((prev) =>
      prev.map((p) =>
        p.id !== propertyId
          ? p
          : {
              ...p,
              rooms: p.rooms.map((r) =>
                r.roomId === roomId ? { ...r, ...next } : r,
              ),
            },
      ),
    );
  }

  function move(propertyId: string, index: number, dir: -1 | 1) {
    setProperties((prev) =>
      prev.map((p) => {
        if (p.id !== propertyId) return p;
        const target = index + dir;
        if (target < 0 || target >= p.rooms.length) return p;
        const rooms = [...p.rooms];
        [rooms[index], rooms[target]] = [rooms[target], rooms[index]];
        return { ...p, rooms };
      }),
    );
  }

  function toggleExpanded(roomId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function onSync() {
    startSync(async () => {
      const res = await syncWebsiteRoomsAction(websiteId);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("roomsSynced"));
      router.refresh();
    });
  }

  function onSave() {
    // Flatten in display order; sort_order is derived from the index server-side.
    const rooms = properties.flatMap((p) =>
      p.rooms.map((r) => ({
        roomId: r.roomId,
        isVisible: r.isVisible,
        displayName: r.displayName,
        displayPrice: r.displayPrice,
        displayCurrency: r.displayCurrency,
        displayDesc: r.displayDesc,
      })),
    );
    startSave(async () => {
      const res = await saveWebsiteRoomsAction({ websiteId, rooms });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("roomsSaved"));
      router.refresh();
    });
  }

  if (total === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-card border border-dashed border-brand-line bg-brand-light/30 p-8 text-center">
          <p className="text-sm text-brand-mute">{t("roomsEmpty")}</p>
        </div>
        <SyncButton onClick={onSync} syncing={syncing} t={t} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-brand-mute">
          {t("roomsShownCount", { shown, total })}
        </p>
        <SyncButton onClick={onSync} syncing={syncing} t={t} />
      </div>

      <div className="space-y-6">
        {properties.map((property) => (
          <section key={property.id}>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
              {property.name}
            </h3>
            <ul className="space-y-2.5">
              {property.rooms.map((room, i) => {
                const open = expanded.has(room.roomId);
                return (
                  <li
                    key={room.roomId}
                    className="rounded-card border border-brand-line bg-white shadow-card"
                  >
                    <div className="flex items-center gap-3 p-3.5">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => move(property.id, i, -1)}
                          disabled={i === 0}
                          aria-label={t("moveUp")}
                          className="rounded p-0.5 text-brand-mute hover:bg-brand-light disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(property.id, i, 1)}
                          disabled={i === property.rooms.length - 1}
                          aria-label={t("moveDown")}
                          className="rounded p-0.5 text-brand-mute hover:bg-brand-light disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-brand-ink">
                            {room.displayName.trim() || room.baseName}
                          </span>
                          {!room.isActive ? (
                            <span className="rounded-pill bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                              {t("roomInactive")}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(room.roomId)}
                          className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-brand-mute hover:text-brand-ink"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          {open ? t("roomHideOverrides") : t("roomEditDisplay")}
                        </button>
                      </div>

                      <div className="shrink-0">
                        <ToggleField
                          label=""
                          checked={room.isVisible}
                          onChange={(v) =>
                            patchRoom(property.id, room.roomId, {
                              isVisible: v,
                            })
                          }
                        />
                      </div>
                    </div>

                    {open ? (
                      <div className="space-y-3 border-t border-brand-line bg-brand-light/20 p-3.5">
                        <TextField
                          label={t("roomDisplayName")}
                          value={room.displayName}
                          onChange={(v) =>
                            patchRoom(property.id, room.roomId, {
                              displayName: v,
                            })
                          }
                          placeholder={room.baseName}
                          maxLength={120}
                          hint={t("roomOverrideHint")}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <TextField
                            label={t("roomDisplayPrice")}
                            value={room.displayPrice}
                            onChange={(v) =>
                              patchRoom(property.id, room.roomId, {
                                displayPrice: v.replace(/[^\d.]/g, ""),
                              })
                            }
                            placeholder={
                              room.basePrice == null
                                ? "—"
                                : String(room.basePrice)
                            }
                          />
                          <TextField
                            label={t("roomDisplayCurrency")}
                            value={room.displayCurrency}
                            onChange={(v) =>
                              patchRoom(property.id, room.roomId, {
                                displayCurrency: v
                                  .toUpperCase()
                                  .replace(/[^A-Z]/g, "")
                                  .slice(0, 3),
                              })
                            }
                            placeholder={room.baseCurrency}
                            maxLength={3}
                          />
                        </div>
                        <p className="text-[11.5px] text-brand-mute">
                          {t("roomPriceCosmetic")}
                        </p>
                        <TextArea
                          label={t("roomDisplayDesc")}
                          value={room.displayDesc}
                          onChange={(v) =>
                            patchRoom(property.id, room.roomId, {
                              displayDesc: v,
                            })
                          }
                          placeholder={room.baseDesc ?? ""}
                          maxLength={600}
                          rows={3}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-brand-line bg-white/95 px-1 py-3 backdrop-blur">
        {dirty ? (
          <span className="text-[12.5px] text-brand-mute">
            {t("roomsUnsaved")}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("saveChanges")}
        </button>
      </div>
    </div>
  );
}

function SyncButton({
  onClick,
  syncing,
  t,
}: {
  onClick: () => void;
  syncing: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncing}
      title={t("roomsSyncHint")}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {t("roomsSync")}
    </button>
  );
}
