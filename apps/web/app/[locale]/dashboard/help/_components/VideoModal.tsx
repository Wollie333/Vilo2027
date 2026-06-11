"use client";

import { Play, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { buildEmbedUrl } from "@/lib/help/embed";
import type { HelpVideoRow } from "@/lib/help/types";

type Props = {
  video: HelpVideoRow;
  thumb: string;
  durationLabel: string;
  categoryLabel: string;
};

export function VideoCardClient({
  video,
  thumb,
  durationLabel,
  categoryLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block overflow-hidden rounded-card border border-brand-line bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="relative aspect-video overflow-hidden bg-brand-secondary">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/70 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-brand-secondary shadow-lift transition-transform group-hover:scale-110">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </div>
          </div>
          {video.is_new ? (
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/30 backdrop-blur">
              <Sparkles className="h-3 w-3" /> NEW
            </div>
          ) : null}
          {durationLabel ? (
            <div className="absolute bottom-2 right-2 rounded bg-brand-dark/90 px-1.5 py-0.5 font-mono text-[10px] text-white">
              {durationLabel}
            </div>
          ) : null}
        </div>
        <div className="p-4">
          <div className="text-xs text-brand-mute">{categoryLabel}</div>
          <h4 className="mt-1 font-display text-sm font-semibold leading-snug text-brand-ink">
            {video.title}
          </h4>
        </div>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={video.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-card bg-brand-dark shadow-lift">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
              aria-label="Close video"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="aspect-video">
              <iframe
                src={buildEmbedUrl(video.embed_provider, video.embed_id)}
                title={video.title}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="p-4 text-white">
              <div className="font-display text-base font-semibold">
                {video.title}
              </div>
              {video.description ? (
                <p className="mt-1 text-sm text-white/70">
                  {video.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
