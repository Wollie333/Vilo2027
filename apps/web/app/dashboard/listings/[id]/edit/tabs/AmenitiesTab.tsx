"use client";

import { Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

import { assignAmenityToRoomAction, replaceAmenitiesAction } from "../actions";
import type { EditorAmenity, EditorRoom } from "../Editor";

export function AmenitiesTab({
  listingId,
  initial,
  rooms,
  groups,
}: {
  listingId: string;
  initial: EditorAmenity[];
  rooms: EditorRoom[];
  groups: AmenityGroupWithItems[];
}) {
  const [items, setItems] = useState<EditorAmenity[]>(initial);
  const [pending, start] = useTransition();

  const keysSelected = useMemo(() => new Set(items.map((i) => i.key)), [items]);

  function toggle(key: string) {
    setItems((prev) => {
      const exists = prev.some((p) => p.key === key);
      if (exists) return prev.filter((p) => p.key !== key);
      return [...prev, { id: `tmp-${key}`, key, label: null, roomId: null }];
    });
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
          label: r.label,
          roomId: r.roomId,
        })),
      );
      toast.success("Amenities saved");
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
        toast.success(
          roomId ? "Amenity assigned to room" : "Amenity unassigned",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Amenities
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Check whatever applies. Save replaces the whole set. For per-room
          listings, assign each amenity to a specific room or leave it as
          listing-wide.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="rounded border border-dashed border-brand-line bg-brand-light/40 px-3 py-3 text-[12.5px] text-brand-mute">
            No amenities available. Ask an admin to add some in{" "}
            <span className="font-mono">/admin/platform/amenities</span>.
          </p>
        ) : null}

        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.id}>
              <h3 className="mb-2 font-display text-sm font-semibold text-brand-dark">
                {g.label}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.items.map((a) => {
                  const checked = keysSelected.has(a.slug);
                  const item = items.find((i) => i.key === a.slug);
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                          : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
                      }`}
                    >
                      <label className="flex flex-1 cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(a.slug)}
                        />
                        {a.label}
                      </label>
                      {checked && rooms.length > 0 && item ? (
                        <select
                          value={item.roomId ?? ""}
                          onChange={(e) =>
                            assign(
                              item.id,
                              e.target.value === "" ? null : e.target.value,
                            )
                          }
                          className="rounded border border-brand-line bg-white px-2 py-1 text-[11px] text-brand-mute"
                          aria-label="Assign amenity to room"
                        >
                          <option value="">Listing-wide</option>
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
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-xs text-brand-mute">
            {keysSelected.size} selected
          </div>
          <Button
            type="button"
            onClick={save}
            disabled={pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save amenities"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
