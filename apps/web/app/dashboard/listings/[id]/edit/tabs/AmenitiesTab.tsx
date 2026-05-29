"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AmenitiesPicker } from "@/components/listing/AmenitiesPicker";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

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
  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Amenities
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Check whatever applies. Save replaces the whole set. For per-room
          listings, assign each amenity to a specific room or leave it
          listing-wide.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AmenitiesPicker
          listingId={listingId}
          groups={groups}
          initial={initial.map((a) => ({
            id: a.id,
            key: a.key,
            roomId: a.roomId,
          }))}
          rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
        />
      </CardContent>
    </Card>
  );
}
