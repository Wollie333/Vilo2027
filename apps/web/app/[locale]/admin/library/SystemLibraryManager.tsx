"use client";

import { Copy, ImagePlus, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

import { createLibraryUploadUrlAction, deleteLibraryImage } from "./actions";

const BUCKET = "marketing-assets";

export type LibraryImage = {
  path: string;
  url: string;
  sizeBytes: number | null;
  mime: string | null;
  createdAt: string | null;
  inUse: boolean;
};

function humanSize(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SystemLibraryManager({ images }: { images: LibraryImage[] }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, start] = useTransition();
  const [q, setQ] = useState("");

  const shown = q.trim()
    ? images.filter((i) =>
        i.path.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : images;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (!files.length) return;

    setUploading(true);
    let ok = 0;
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} is over 25 MB — skipped.`);
          continue;
        }
        const ticket = await createLibraryUploadUrlAction({
          fileName: file.name,
        });
        if (!ticket.ok) {
          toast.error(ticket.error);
          continue;
        }
        const { error } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: file.type || undefined,
          });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }
        ok++;
      }
      if (ok) {
        toast.success(`Uploaded ${ok} image${ok === 1 ? "" : "s"}.`);
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Image URL copied."),
      () => toast.error("Couldn't copy."),
    );
  }

  function remove(img: LibraryImage) {
    if (img.inUse) {
      toast.error("This image backs an affiliate asset — remove that first.");
      return;
    }
    if (!confirm("Delete this image? This can't be undone.")) return;
    start(async () => {
      const r = await deleteLibraryImage({ path: img.path });
      if (r.ok) {
        toast.success("Image deleted.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            System library
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-mute">
            Images for the <strong>Wielo app itself</strong> — affiliate
            resources, promo art and anything the platform needs. App-scoped and
            shared across admin. (A host&rsquo;s own listing images live in
            their dashboard, not here.)
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload images
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onPick}
        />
      </div>

      {images.length > 0 ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by file name…"
          className="w-full max-w-sm rounded-md border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
        />
      ) : null}

      {shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <ImagePlus className="h-6 w-6" />
          </div>
          <p className="mx-auto max-w-md text-sm text-brand-mute">
            {images.length === 0
              ? "No images yet. Upload the first one to start your Wielo system library."
              : "No images match that search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((img) => (
            <div
              key={img.path}
              className="group relative overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
            >
              <div className="relative aspect-[4/3] bg-brand-light/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.path}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {img.inUse ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-brand-ink/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Lock className="h-3 w-3" /> In use
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-brand-ink">
                    {img.path.replace(/^\d+-[a-z0-9]+-/, "")}
                  </div>
                  <div className="text-[10px] text-brand-mute">
                    {humanSize(img.sizeBytes)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => copyUrl(img.url)}
                    aria-label="Copy image URL"
                    title="Copy URL"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(img)}
                    disabled={busy || img.inUse}
                    aria-label="Delete image"
                    title={img.inUse ? "In use — can't delete" : "Delete"}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-mute transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
