"use client";

import { Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  assignPhotoToRoomAction,
  deleteListingPhotoAction,
  uploadListingPhotoAction,
} from "../actions";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, startDelete] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadListingPhotoAction(listingId, formData);
    setUploading(false);

    if (result.ok && result.data) {
      onChange([
        ...photos,
        { id: result.data.id, url: result.data.url, roomId: null },
      ]);
      toast.success("Photo uploaded");
    } else if (!result.ok) {
      toast.error(result.error);
    }
  }

  async function assignRoom(photoId: string, roomId: string | null) {
    const result = await assignPhotoToRoomAction(listingId, photoId, roomId);
    if (result.ok) {
      onChange(photos.map((p) => (p.id === photoId ? { ...p, roomId } : p)));
      toast.success(roomId ? "Photo assigned to room" : "Photo unassigned");
    } else {
      toast.error(result.error);
    }
  }

  function remove(photoId: string) {
    startDelete(async () => {
      const result = await deleteListingPhotoAction(listingId, photoId);
      if (result.ok) {
        onChange(photos.filter((p) => p.id !== photoId));
        toast.success("Photo removed");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Photos
        </CardTitle>
        <CardDescription className="text-brand-mute">
          JPEG, PNG or WebP, up to 8 MB. One at a time for now — drag-and-drop
          multi-upload lands later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative flex aspect-[4/3] flex-col overflow-hidden rounded-card border border-brand-line bg-brand-accent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt="Listing photo"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={deleting}
                aria-label="Remove photo"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-status-cancelled opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {rooms.length > 0 ? (
                <select
                  value={p.roomId ?? ""}
                  onChange={(e) =>
                    assignRoom(
                      p.id,
                      e.target.value === "" ? null : e.target.value,
                    )
                  }
                  className="absolute bottom-2 left-2 right-2 rounded border border-white/30 bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                  aria-label="Assign photo to room"
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
          ))}

          <label
            className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-brand-line bg-brand-light/60 text-brand-mute transition-colors hover:border-brand-primary hover:text-brand-primary ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={onFile}
              disabled={uploading}
            />
            <Upload className="h-6 w-6" />
            <span className="text-xs font-medium">
              {uploading ? "Uploading…" : "Add a photo"}
            </span>
          </label>
        </div>

        {photos.length === 0 ? (
          <p className="mt-4 text-xs text-brand-mute">
            At least one photo is recommended before publishing — guests skip
            listings without photos.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
