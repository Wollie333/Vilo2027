"use client";

import { useMemo, useTransition } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

import { setRoomAmenityAction } from "../../../actions";
import { AMENITY_OPTIONS } from "../../../schemas";

export function RoomAmenitiesSection({
  listingId,
  roomId,
  amenityKeys,
  onChange,
}: {
  listingId: string;
  roomId: string;
  amenityKeys: string[];
  onChange: (keys: string[]) => void;
}) {
  const [pending, start] = useTransition();
  const selected = useMemo(() => new Set(amenityKeys), [amenityKeys]);

  function toggle(key: string, on: boolean) {
    // Optimistic — flip locally, server reconciles. Revert on failure.
    const next = on
      ? Array.from(new Set([...amenityKeys, key]))
      : amenityKeys.filter((k) => k !== key);
    onChange(next);
    start(async () => {
      const result = await setRoomAmenityAction(listingId, roomId, key, on);
      if (!result.ok) {
        onChange(amenityKeys);
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
        <div className="mt-4 text-[11px] text-brand-mute">
          {selected.size} amenit{selected.size === 1 ? "y" : "ies"} selected for
          this room.
        </div>
      </CardContent>
    </Card>
  );
}
