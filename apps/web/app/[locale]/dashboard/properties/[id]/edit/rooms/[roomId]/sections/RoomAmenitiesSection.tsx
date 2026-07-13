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

import { setRoomAmenitiesAction, setRoomAmenityAction } from "../../../actions";
import { AMENITY_OPTIONS } from "../../../schemas";

export function RoomAmenitiesSection({
  listingId,
  roomId,
  amenityKeys,
  onChange,
  deferSave = false,
  batchSave = false,
}: {
  listingId: string;
  roomId: string;
  amenityKeys: string[];
  onChange: (keys: string[]) => void;
  /**
   * When true, toggling only updates local state (via onChange) — nothing is
   * saved per click; the parent persists the whole set once (e.g. the setup
   * wizard's "Save room"). Default false keeps the per-toggle save the full
   * room editor relies on.
   */
  deferSave?: boolean;
  /**
   * When true, the host ticks as many boxes as they like and saves the whole
   * set once via the in-card "Save amenities" button (batch replace) — no
   * per-click DB write. Self-contained (unlike deferSave, which needs a parent
   * to persist).
   */
  batchSave?: boolean;
}) {
  const [pending, start] = useTransition();
  const selected = useMemo(() => new Set(amenityKeys), [amenityKeys]);

  // Batch-save bookkeeping — the last persisted set, so we can flag unsaved
  // changes and disable the button when nothing has changed.
  const [savedKeys, setSavedKeys] = useState<string[]>(amenityKeys);
  const dirty = useMemo(() => {
    const a = [...savedKeys].sort().join("|");
    const b = [...amenityKeys].sort().join("|");
    return a !== b;
  }, [savedKeys, amenityKeys]);

  function toggle(key: string, on: boolean) {
    const next = on
      ? Array.from(new Set([...amenityKeys, key]))
      : amenityKeys.filter((k) => k !== key);
    onChange(next);
    if (deferSave || batchSave) return; // persisted in one batch, not per click
    // Optimistic — flip locally, server reconciles. Revert on failure.
    start(async () => {
      const result = await setRoomAmenityAction(listingId, roomId, key, on);
      if (!result.ok) {
        onChange(amenityKeys);
        toast.error(result.error);
      }
    });
  }

  function saveAll() {
    start(async () => {
      const result = await setRoomAmenitiesAction(
        listingId,
        roomId,
        amenityKeys,
      );
      if (result.ok) {
        setSavedKeys(amenityKeys);
        toast.success("Amenities saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Room amenities
        </CardTitle>
        <CardDescription className="text-brand-mute">
          What this specific room offers. Independent from the listing-wide
          amenities — both show up on the guest&rsquo;s room detail page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AMENITY_OPTIONS.map((a) => {
            const checked = selected.has(a.key);
            return (
              <label
                key={a.key}
                className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                    : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggle(a.key, v === true)}
                  disabled={pending}
                />
                {a.label}
              </label>
            );
          })}
        </div>
        {batchSave ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-line pt-4">
            <div className="text-[11px] text-brand-mute">
              {selected.size} amenit{selected.size === 1 ? "y" : "ies"} selected
              {dirty ? (
                <span className="ml-2 font-semibold text-status-pending">
                  · unsaved changes
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              onClick={saveAll}
              disabled={pending || !dirty}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {pending ? "Saving…" : "Save amenities"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 text-[11px] text-brand-mute">
            {selected.size} amenit{selected.size === 1 ? "y" : "ies"} selected
            for this room.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
