"use client";

import { GripVertical, Star, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignPhotoToRoomAction,
  deleteListingPhotoAction,
  reorderListingPhotosAction,
} from "@/app/[locale]/dashboard/properties/[id]/edit/actions";

import {
  PHOTO_ACCEPT_ATTR,
  uploadListingPhotos,
  validatePhotoFiles,
} from "./photoUpload";

export type ManagedPhoto = { id: string; url: string; roomId?: string | null };

// Single source of truth for listing photos. Rendered by the listing editor's
// Photos tab and the setup Listing card. Multi-file upload, drag-to-reorder
// (first photo is the cover) and delete are always on. Pass `rooms` to enable
// per-room assignment (editor); omit it for listing-wide only (setup).
//
// Chrome-less: the caller supplies its own heading/Card. This renders the grid
// + drop-zone + helper text only.
export function PhotosManager({
  listingId,
  photos,
  rooms,
  onChange,
}: {
  listingId: string;
  photos: ManagedPhoto[];
  rooms?: { id: string; name: string }[];
  onChange: (photos: ManagedPhoto[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<{
    total: number;
    done: number;
  }>({ total: 0, done: 0 });
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [deleting, startDelete] = useTransition();

  // Drag-to-reorder: source index is the photo being dragged; over index is
  // the photo currently being hovered. Both reset on dragend.
  const [dragSourceIdx, setDragSourceIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const uploading = uploadQueue.total > 0;
  const uploadingLabel =
    uploadQueue.total > 1
      ? `Uploading ${uploadQueue.done + 1} of ${uploadQueue.total}…`
      : "Uploading…";

  async function uploadFiles(files: File[]) {
    const valid = validatePhotoFiles(files, (m) => toast.error(m));
    if (valid.length === 0) return;

    // Snapshot the existing photos so the concurrent uploads append after them
    // in selection order (keeps the cover — the first photo — predictable).
    const base = photos;
    setUploadQueue({ total: valid.length, done: 0 });
    try {
      const uploaded = await uploadListingPhotos({
        listingId,
        files: valid,
        onProgress: (done, total) => setUploadQueue({ total, done }),
        onPhotos: (completed) =>
          onChange([
            ...base,
            ...completed.map((p) => ({ ...p, roomId: null })),
          ]),
        onError: (m) => toast.error(m),
      });
      if (uploaded.length > 0) {
        toast.success(
          uploaded.length === 1
            ? "Photo uploaded"
            : `${uploaded.length} photos uploaded`,
        );
      }
    } finally {
      setUploadQueue({ total: 0, done: 0 });
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) {
      e.target.value = "";
      return;
    }
    const files = Array.from(list);
    e.target.value = "";
    // Immediate, unmissable confirmation that the picker → handler fired.
    toast(`Adding ${files.length} photo${files.length === 1 ? "" : "s"}…`);
    void uploadFiles(files);
  }

  function openPicker() {
    if (!uploading) inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDropTarget(false);
    const list = e.dataTransfer.files;
    if (!list || list.length === 0) return;
    void uploadFiles(Array.from(list));
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Only highlight when files are being dragged in — ignore in-page card
    // reorder events that bubble up here.
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setIsDropTarget(true);
    }
  }

  function onDragLeave() {
    setIsDropTarget(false);
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

  // ─── Reorder via HTML5 drag-and-drop ─────────────────────────────
  function onCardDragStart(index: number) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      // setData is required by Firefox for the drag to actually start.
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
      setDragSourceIdx(index);
    };
  }

  function onCardDragOver(index: number) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      if (dragSourceIdx === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverIdx !== index) setDragOverIdx(index);
    };
  }

  function onCardDragLeave(index: number) {
    return () => {
      if (dragOverIdx === index) setDragOverIdx(null);
    };
  }

  function onCardDrop(targetIdx: number) {
    return async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceIdx = dragSourceIdx;
      setDragSourceIdx(null);
      setDragOverIdx(null);
      if (sourceIdx === null || sourceIdx === targetIdx) return;

      const next = [...photos];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);
      onChange(next);

      const result = await reorderListingPhotosAction(
        listingId,
        next.map((p) => p.id),
      );
      if (!result.ok) {
        toast.error(result.error);
        // Roll back local state on server failure.
        onChange(photos);
      }
    };
  }

  function onCardDragEnd() {
    setDragSourceIdx(null);
    setDragOverIdx(null);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, index) => {
          const isCover = index === 0;
          const isDraggingThis = dragSourceIdx === index;
          const isDragOverThis =
            dragOverIdx === index && dragSourceIdx !== index;
          return (
            <div
              key={p.id}
              draggable={!uploading && !deleting}
              onDragStart={onCardDragStart(index)}
              onDragOver={onCardDragOver(index)}
              onDragLeave={onCardDragLeave(index)}
              onDrop={onCardDrop(index)}
              onDragEnd={onCardDragEnd}
              className={`group relative flex aspect-[4/3] flex-col overflow-hidden rounded-card border bg-brand-accent transition-all ${
                isDraggingThis
                  ? "border-brand-primary opacity-40"
                  : isDragOverThis
                    ? "border-brand-primary ring-2 ring-brand-primary/40"
                    : "border-brand-line"
              } ${uploading || deleting ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={isCover ? "Listing cover photo" : "Listing photo"}
                draggable={false}
                className="h-full w-full select-none object-cover"
              />

              {isCover ? (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-brand-secondary shadow-card">
                  <Star className="h-3 w-3 fill-current" />
                  Cover
                </div>
              ) : null}

              <div
                aria-hidden
                className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-brand-mute opacity-0 transition-opacity group-hover:opacity-100"
              >
                <GripVertical className="h-4 w-4" />
              </div>

              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={deleting}
                aria-label="Remove photo"
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-status-cancelled opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              {rooms && rooms.length > 0 ? (
                <select
                  value={p.roomId ?? ""}
                  onChange={(e) =>
                    assignRoom(
                      p.id,
                      e.target.value === "" ? null : e.target.value,
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => e.preventDefault()}
                  className="absolute bottom-2 left-2 right-12 rounded border border-white/30 bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
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
          );
        })}

        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed text-center transition-colors ${
            isDropTarget
              ? "border-brand-primary bg-brand-accent/60 text-brand-primary"
              : "border-brand-line bg-brand-light/60 text-brand-mute hover:border-brand-primary hover:text-brand-primary"
          } ${uploading ? "opacity-60" : ""}`}
        >
          <UploadCloud className="h-7 w-7" />
          <div className="text-xs font-medium leading-tight">
            {uploading ? (
              uploadingLabel
            ) : isDropTarget ? (
              "Drop to upload"
            ) : (
              <>
                Drag &amp; drop or{" "}
                <span className="text-brand-primary underline-offset-2">
                  browse
                </span>
              </>
            )}
          </div>
          <div className="text-[10px] text-brand-mute/80">
            Landscape works best — at least 1600×1200px (4:3). JPG, PNG or WebP
            · up to 8 MB each. The first photo is your cover.
          </div>
        </div>
      </div>

      {/* Always-mounted, never-disabled file input (triggered via openPicker). */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={PHOTO_ACCEPT_ATTR}
        className="hidden"
        onChange={onFileInput}
      />

      {photos.length === 0 ? (
        <p className="mt-4 text-xs text-brand-mute">
          At least one photo is recommended before publishing — guests skip
          listings without photos.
        </p>
      ) : (
        <p className="mt-4 text-xs text-brand-mute">
          <Star className="-mt-0.5 mr-1 inline h-3 w-3 fill-brand-primary text-brand-primary" />
          The first photo is your listing cover. Drag any photo to a new
          position to change it.
        </p>
      )}
    </div>
  );
}
