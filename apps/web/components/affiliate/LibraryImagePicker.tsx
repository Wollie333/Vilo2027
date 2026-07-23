"use client";

import { Image as ImageIcon } from "lucide-react";
import { useState } from "react";

import { FormModal } from "@/components/ui/form-modal";

type Img = { path: string; url: string };

// Pick a single image from the Wielo media library. Uploads happen in the
// Marketing tab; this only assigns an already-uploaded image (a URL) to a field.
export function LibraryImagePicker({
  images,
  value,
  onChange,
}: {
  images: Img[];
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {value ? (
        <span className="relative h-16 w-28 overflow-hidden rounded-[10px] border border-brand-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Selected"
            className="h-full w-full object-cover"
          />
        </span>
      ) : (
        <span className="flex h-16 w-28 items-center justify-center rounded-[10px] border border-dashed border-brand-line text-brand-mute">
          <ImageIcon className="h-5 w-5" />
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-sec h-9"
      >
        {value ? "Change image" : "Choose from library"}
      </button>
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="btn-ghost h-9"
        >
          Clear
        </button>
      ) : null}

      <FormModal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Choose an image"
        description="Pick from the Wielo media library. Upload new images in the Marketing tab."
      >
        {images.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-brand-mute">
            The library is empty — upload images in the Marketing tab first.
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {images.map((img) => (
              <button
                key={img.path}
                type="button"
                onClick={() => {
                  onChange(img.url);
                  setOpen(false);
                }}
                title={img.path}
                className={`group relative aspect-square overflow-hidden rounded-[10px] border transition hover:border-brand-primary ${
                  value === img.url
                    ? "border-brand-primary ring-2 ring-brand-primary/30"
                    : "border-brand-line"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.path}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </FormModal>
    </div>
  );
}
