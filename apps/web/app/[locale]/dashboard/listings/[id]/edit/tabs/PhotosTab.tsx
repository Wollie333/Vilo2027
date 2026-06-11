"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhotosManager } from "@/components/listing/PhotosManager";

import type { EditorPhoto, EditorRoom } from "../Editor";

export function PhotosTab({
  listingId,
  photos,
  rooms,
  onChange,
}: {
  listingId: string;
  photos: EditorPhoto[];
  rooms: EditorRoom[];
  onChange: (photos: EditorPhoto[]) => void;
}) {
  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Photos
        </CardTitle>
        <CardDescription className="text-brand-mute">
          JPEG, PNG or WebP, up to 8 MB each. Drag to reorder — the first photo
          is your listing cover.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PhotosManager
          listingId={listingId}
          photos={photos}
          rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
          onChange={(next) =>
            onChange(
              next.map((p) => ({
                id: p.id,
                url: p.url,
                roomId: p.roomId ?? null,
              })),
            )
          }
        />
      </CardContent>
    </Card>
  );
}
