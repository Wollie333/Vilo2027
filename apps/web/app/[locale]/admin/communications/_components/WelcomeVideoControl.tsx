"use client";

import { Film, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveOnboardingVideo } from "@/app/[locale]/admin/help/settings/actions";
import { parseVideoEmbed } from "@/lib/help/embed";

// Admin control for the host onboarding overview welcome video. Paste a YouTube
// or Vimeo link → the host overview hero plays it instead of the progress ring.
// Clearing the field reverts the hero to the ring.
export function WelcomeVideoControl({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [pending, startTransition] = useTransition();

  const trimmed = url.trim();
  const parsed = trimmed ? parseVideoEmbed(trimmed) : null;
  const invalid = trimmed.length > 0 && !parsed;
  const dirty = trimmed !== savedUrl.trim();

  function save(next: string) {
    startTransition(async () => {
      const res = await saveOnboardingVideo({ url: next });
      if (res.ok) {
        setSavedUrl(next);
        toast.success(next ? "Welcome video saved." : "Welcome video cleared.");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
          <Film className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-display text-[17px] font-bold text-brand-ink">
            Onboarding welcome video
          </h2>
          <p className="text-[12.5px] text-brand-mute">
            Shown in the host overview hero for new accounts. Leave empty to
            show the setup progress ring instead.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=…  or  https://vimeo.com/…"
          disabled={pending}
          className={`h-11 flex-1 rounded-[10px] border bg-white px-3.5 text-[13.5px] text-brand-ink outline-none transition focus:ring-2 ${
            invalid
              ? "border-status-cancelled focus:ring-status-cancelled/30"
              : "border-brand-line focus:ring-brand-primary/30"
          }`}
        />
        <button
          type="button"
          onClick={() => save(trimmed)}
          disabled={pending || invalid || !dirty}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-5 text-[13.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
        {savedUrl ? (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              save("");
            }}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-4 text-[13.5px] font-medium text-brand-mute transition hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        ) : null}
      </div>

      {invalid ? (
        <p className="mt-2 text-[12px] font-medium text-status-cancelled">
          That doesn&rsquo;t look like a YouTube or Vimeo link.
        </p>
      ) : null}

      {parsed ? (
        <div className="mt-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Preview
          </div>
          <div className="mt-2 aspect-video w-full max-w-md overflow-hidden rounded-[10px] border border-brand-line bg-black">
            <iframe
              src={parsed.embedUrl}
              title="Welcome video preview"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
