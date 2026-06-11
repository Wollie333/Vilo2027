"use client";

import { useRef, useState, useTransition } from "react";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeHostLogoAction, uploadHostLogoAction } from "../actions";

/** Resize an image to <= max px on its longest edge, client-side, preserving
 *  transparency for PNG/WebP. Keeps the upload tiny + the PDF crisp. */
async function resizeImage(file: File, max = 512): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, type, 0.92),
  );
  if (!blob) return file;
  const ext = type === "image/jpeg" ? "jpg" : "png";
  return new File([blob], `logo.${ext}`, { type });
}

export function LogoUploader({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image.");
      return;
    }
    start(async () => {
      const resized = await resizeImage(file).catch(() => file);
      const fd = new FormData();
      fd.append("file", resized);
      const res = await uploadHostLogoAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(`${res.url}?t=${Date.now()}`);
      toast.success("Logo updated.");
    });
  }

  function remove() {
    start(async () => {
      const res = await removeHostLogoAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(null);
      toast.success("Logo removed.");
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-brand-line bg-brand-light">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Business logo"
            className="h-full w-full object-contain"
          />
        ) : (
          <ImagePlus className="h-6 w-6 text-brand-mute" />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-brand-ink">
          Logo on your documents
        </div>
        <p className="mt-0.5 text-xs text-brand-mute">
          Shown on quotes, invoices &amp; credit notes. PNG with transparency
          works best. Auto-resized.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-accent disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ImagePlus className="h-3 w-3" />
            )}
            {url ? "Replace logo" : "Upload logo"}
          </button>
          {url ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-status-cancelled transition hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
