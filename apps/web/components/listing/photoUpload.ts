"use client";

// Shared concurrent photo uploader for listing + room photos. Uploading files
// one-by-one is slow; this runs several at once (signed-URL upload straight to
// Storage → register the row) while preserving the selection order so the cover
// stays predictable. Used by PhotosManager (listing) and RoomPhotosSection.

import {
  createListingPhotoUploadUrl,
  registerListingPhotoAction,
} from "@/app/[locale]/dashboard/properties/[id]/edit/actions";
import { createClient } from "@/lib/supabase/client";

export const PHOTO_ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_ACCEPT_ATTR = "image/jpeg,image/png,image/webp";
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export type UploadedPhoto = { id: string; url: string };

/** Drop files with the wrong type / too large, reporting each rejection. */
export function validatePhotoFiles(
  files: File[],
  onReject: (message: string) => void,
): File[] {
  return files.filter((f) => {
    if (!PHOTO_ACCEPTED.includes(f.type)) {
      onReject(`${f.name}: use a JPEG, PNG or WebP image.`);
      return false;
    }
    if (f.size > PHOTO_MAX_BYTES) {
      onReject(`${f.name}: photo must be under 8 MB.`);
      return false;
    }
    return true;
  });
}

export type UploadPhotosOptions = {
  listingId: string;
  /** Set to attach every uploaded photo to a specific room. */
  roomId?: string | null;
  files: File[];
  /** Max simultaneous uploads (browsers cap ~6 connections anyway). */
  concurrency?: number;
  /** Fired after each file settles — for a live "X of N" label. */
  onProgress?: (done: number, total: number) => void;
  /** Fired after each file settles with the completed set IN SELECTION ORDER,
   *  so the caller can append live without scrambling the cover. */
  onPhotos?: (completedInOrder: UploadedPhoto[]) => void;
  onError?: (message: string) => void;
};

/**
 * Upload `files` concurrently. Returns every successfully-registered photo in the
 * original selection order. Failures are reported via `onError` and skipped.
 */
export async function uploadListingPhotos({
  listingId,
  roomId = null,
  files,
  concurrency = 4,
  onProgress,
  onPhotos,
  onError,
}: UploadPhotosOptions): Promise<UploadedPhoto[]> {
  if (files.length === 0) return [];
  // Create the browser client only when actually uploading (never at render).
  const supabase = createClient();
  const results: (UploadedPhoto | null)[] = new Array(files.length).fill(null);
  let done = 0;
  let cursor = 0;

  async function uploadOne(i: number) {
    const file = files[i];
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    try {
      const ticket = await createListingPhotoUploadUrl(
        listingId,
        ext,
        roomId ?? undefined,
      );
      if (!ticket.ok || !ticket.data) {
        onError?.(
          `${file.name}: ${ticket.ok ? "could not start upload" : ticket.error}`,
        );
        return;
      }
      const { error: upErr } = await supabase.storage
        .from("listing-photos")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (upErr) {
        onError?.(`${file.name}: ${upErr.message || "upload failed"}`);
        return;
      }
      const result = await registerListingPhotoAction(
        listingId,
        ticket.data.path,
        roomId ?? undefined,
      );
      if (result.ok && result.data) {
        results[i] = { id: result.data.id, url: result.data.url };
      } else if (!result.ok) {
        onError?.(`${file.name}: ${result.error}`);
      }
    } catch (err) {
      onError?.(
        `${file.name}: ${err instanceof Error ? err.message : "upload error"}`,
      );
    } finally {
      done += 1;
      onProgress?.(done, files.length);
      onPhotos?.(results.filter((p): p is UploadedPhoto => p !== null));
    }
  }

  async function worker() {
    while (cursor < files.length) {
      const i = cursor;
      cursor += 1;
      await uploadOne(i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, () => worker()),
  );

  return results.filter((p): p is UploadedPhoto => p !== null);
}
