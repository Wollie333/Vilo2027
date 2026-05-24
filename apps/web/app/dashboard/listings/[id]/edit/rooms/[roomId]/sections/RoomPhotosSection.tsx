"use client";

import { Star, Trash2, Upload } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  deleteListingPhotoAction,
  setRoomFeaturedPhotoAction,
  uploadListingPhotoAction,
} from "../../../actions";
import type { RoomEditorPhoto } from "../RoomEditor";

export function RoomPhotosSection({
  listingId,
  roomId,
  featuredPhotoId,
  photos,
  onPhotosChange,
  onFeaturedChange,
}: {
  listingId: string;
  roomId: string;
  featuredPhotoId: string | null;
  photos: RoomEditorPhoto[];
  onPhotosChange: (photos: RoomEditorPhoto[]) => void;
  onFeaturedChange: (photoId: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPending, startUpload] = useTransition();

  function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    startUpload(async () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("room_id", roomId);
      const result = await uploadListingPhotoAction(listingId, fd);
      if (result.ok && result.data) {
        onPhotosChange([
          ...photos,
          { id: result.data.id, url: result.data.url },
        ]);
        toast.success("Photo uploaded");
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function remove(photoId: string) {
    if (!window.confirm("Delete this photo?")) return;
    deleteListingPhotoAction(listingId, photoId).then((result) => {
      if (result.ok) {
        onPhotosChange(photos.filter((p) => p.id !== photoId));
        if (featuredPhotoId === photoId) onFeaturedChange(null);
        toast.success("Photo deleted");
      } else {
        toast.error(result.error);
      }
    });
  }

  function setFeatured(photoId: string | null) {
    setRoomFeaturedPhotoAction(listingId, roomId, photoId).then((result) => {
      if (result.ok) {
        onFeaturedChange(photoId);
        toast.success(photoId ? "Cover photo updated" : "Cover cleared");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Room photos
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Upload photos that belong only to this room. Pick one as the cover —
          guests see it on the listing&rsquo;s room card.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => {
            const isFeatured = p.id === featuredPhotoId;
            return (
              <div
                key={p.id}
                className={`group relative overflow-hidden rounded-card border bg-brand-accent ${
                  isFeatured
                    ? "border-brand-primary ring-2 ring-brand-primary/40"
                    : "border-brand-line"
                }`}
              >
                <div className="aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                {isFeatured ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white">
                    <Star className="h-3 w-3 fill-white" /> Cover
                  </span>
                ) : null}
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setFeatured(isFeatured ? null : p.id)}
                    className="inline-flex items-center gap-1 rounded-pill bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-brand-dark backdrop-blur hover:bg-white"
                  >
                    <Star className="h-3 w-3" />
                    {isFeatured ? "Unset cover" : "Set cover"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="inline-flex items-center justify-center rounded-pill bg-white/90 p-1 text-status-cancelled backdrop-blur hover:bg-white"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadPending}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-brand-line bg-brand-light/40 text-xs font-medium text-brand-mute transition-colors hover:border-brand-primary hover:bg-brand-accent/40 hover:text-brand-primary disabled:opacity-50"
          >
            <Upload className="h-5 w-5" />
            {uploadPending ? "Uploading…" : "Add photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files);
              if (e.target) e.target.value = "";
            }}
          />
        </div>

        {photos.length === 0 ? (
          <p className="mt-4 text-xs text-brand-mute">
            No photos for this room yet. Add one to make the room card eye-
            catching.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
