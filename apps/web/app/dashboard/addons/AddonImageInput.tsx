"use client";

import { Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAddonImageAction, uploadAddonImageAction } from "./actions";

export function AddonImageInput({
  addonId,
  imageUrl,
  onChange,
}: {
  addonId: string;
  imageUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, startDelete] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Choose an image file.");
    // Keep under the Vercel Server-Action body cap (~4.5MB) — the action
    // enforces the same 4MB limit server-side.
    if (file.size > 4 * 1024 * 1024)
      return toast.error("Image must be 4 MB or smaller.");

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadAddonImageAction(addonId, formData);
    setUploading(false);

    if (result.ok && result.data) {
      onChange(result.data.url);
      toast.success("Image uploaded");
    } else if (!result.ok) {
      toast.error(result.error);
    }
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteAddonImageAction(addonId);
      if (result.ok) {
        onChange(null);
        toast.success("Image removed");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-start gap-3">
      <div className="group relative flex h-24 w-24 shrink-0 overflow-hidden rounded-card border border-brand-line bg-brand-accent/40">
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Add-on"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              aria-label="Remove image"
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-status-cancelled opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-mute">
            <Upload className="h-5 w-5" />
          </div>
        )}
      </div>

      <label
        className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-card border-2 border-dashed border-brand-line bg-brand-light/60 px-4 py-3 text-xs font-medium text-brand-mute transition-colors hover:border-brand-primary hover:text-brand-primary ${
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
        <Upload className="h-4 w-4" />
        <span>
          {uploading
            ? "Uploading…"
            : imageUrl
              ? "Replace featured image"
              : "Upload featured image"}
        </span>
      </label>
    </div>
  );
}
