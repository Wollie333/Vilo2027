"use client";

import { Check } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignAmenityToRoomAction,
  replaceAmenitiesAction,
} from "@/app/dashboard/listings/[id]/edit/actions";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

type Item = { id: string; key: string; roomId: string | null };

// Single source of truth for selecting listing amenities. Rendered by the
// listing editor's Amenities tab and the setup Listing card. Pass `rooms` to
// enable per-room assignment (editor); omit it for listing-wide only (setup).
export function AmenitiesPicker({
  listingId,
  groups,
  initial,
  rooms,
  onSaved,
}: {
  listingId: string;
  groups: AmenityGroupWithItems[];
  initial: Item[];
  rooms?: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [pending, start] = useTransition();
  const selected = useMemo(() => new Set(items.map((i) => i.key)), [items]);

  function toggle(key: string) {
    setItems((prev) =>
      prev.some((p) => p.key === key)
        ? prev.filter((p) => p.key !== key)
        : [...prev, { id: `tmp-${key}`, key, roomId: null }],
    );
  }

  function save() {
    start(async () => {
      const result = await replaceAmenitiesAction(
        listingId,
        items.map((i) => i.key),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems(
        (result.data ?? []).map((r) => ({
          id: r.id,
          key: r.key,
          roomId: r.roomId,
        })),
      );
      toast.success("Amenities saved.");
      onSaved?.();
    });
  }

  function assign(amenityId: string, roomId: string | null) {
    if (amenityId.startsWith("tmp-")) {
      toast.error("Save amenities first, then assign per-room.");
      return;
    }
    assignAmenityToRoomAction(listingId, amenityId, roomId).then((result) => {
      if (result.ok) {
        setItems((prev) =>
          prev.map((p) => (p.id === amenityId ? { ...p, roomId } : p)),
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-brand-line bg-brand-light/40 px-3 py-3 text-[12.5px] text-brand-mute">
        No amenities available yet. An admin can add them in{" "}
        <span className="font-mono">/admin/platform/amenities</span>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.id}>
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            {g.label}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((a) => {
              const checked = selected.has(a.slug);
              const item = items.find((i) => i.key === a.slug);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 rounded-card border px-3 py-2.5 text-sm transition ${
                    checked
                      ? "border-brand-primary bg-brand-accent/40 text-brand-ink"
                      : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(a.slug)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                        checked
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-brand-line"
                      }`}
                    >
                      {checked ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {a.label}
                    </span>
                  </button>
                  {checked && rooms && rooms.length > 0 && item ? (
                    <select
                      value={item.roomId ?? ""}
                      onChange={(e) => assign(item.id, e.target.value || null)}
                      className="shrink-0 rounded border border-brand-line bg-white px-1.5 py-1 text-[10.5px] text-brand-mute"
                      aria-label="Assign amenity to room"
                    >
                      <option value="">All</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex items-center justify-between border-t border-brand-line pt-4">
        <span className="num text-xs text-brand-mute">
          {selected.size} selected
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save amenities"}
        </button>
      </div>
    </div>
  );
}
