// Shared constants + URL helper for review photos. The bucket is PUBLIC, so a
// public object URL can be built from the storage path without a client call —
// this is the single source of truth used by the submit form, host dashboard,
// listing page, admin and guest portal.

export const REVIEW_PHOTO_BUCKET = "review-photos";
export const MAX_REVIEW_PHOTOS = 6;
export const MAX_REVIEW_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
export const ACCEPTED_REVIEW_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Public URL for a review photo stored at `path` in the review-photos bucket. */
export function reviewPhotoUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${REVIEW_PHOTO_BUCKET}/${path}`;
}
