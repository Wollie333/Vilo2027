"use client";

import { ImageOff, Loader2, Search, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

import {
  createHelpMediaUploadUrl,
  listBrandMedia,
  type BrandMediaImage,
} from "../media-actions";

const BUCKET = "marketing-assets";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen image's public URL. */
  onSelect: (url: string) => void;
};

/**
 * Picker over the Wielo System / brand media library (the shared public
 * `marketing-assets` bucket). Browse existing brand images or upload a new one;
 * selecting resolves the public URL back to the caller.
 */
export function BrandMediaPicker({ open, onOpenChange, onSelect }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<BrandMediaImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    listBrandMedia().then((res) => {
      if (!active) return;
      if (res.ok) setImages(res.images);
      else toast.error(res.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open]);

  function choose(url: string) {
    onSelect(url);
    onOpenChange(false);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(`${file.name} is over 25 MB.`);
      return;
    }
    setUploading(true);
    try {
      const ticket = await createHelpMediaUploadUrl({ fileName: file.name });
      if (!ticket.ok) {
        toast.error(ticket.error);
        return;
      }
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || undefined,
        });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Uploaded to the brand library.");
      choose(ticket.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  const shown = q.trim()
    ? images.filter((i) =>
        i.path.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : images;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Brand media library</DialogTitle>
          <DialogDescription>
            Pick an image from the Wielo brand library, or upload a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by file name…"
              className="w-full rounded-md border border-brand-line bg-white py-2 pl-8 pr-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onUpload}
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border border-brand-line bg-brand-light/40 p-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-brand-mute">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : shown.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-brand-mute">
              <ImageOff className="h-6 w-6" />
              <span className="text-sm">
                {images.length === 0
                  ? "No images yet — upload one to get started."
                  : "No images match your search."}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {shown.map((img) => (
                <button
                  key={img.path}
                  type="button"
                  onClick={() => choose(img.url)}
                  title={img.path}
                  className="group relative aspect-[4/3] overflow-hidden rounded-md border border-brand-line bg-white transition hover:border-brand-primary hover:ring-2 hover:ring-brand-primary/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
