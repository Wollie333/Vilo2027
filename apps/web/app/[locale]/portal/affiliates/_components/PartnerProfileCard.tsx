"use client";
import { Check, Copy, ExternalLink, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadPartnerPhotoAction } from "@/app/[locale]/signup/partner/actions";

import { updatePartnerProfileAction } from "../actions";

// Editor for the affiliate's co-branded /partners/<slug> landing page (WS-1.7).
// Headline + bio + photo URL. No money — presentation only. Matches the
// ReferralLinkCard styling in this same folder.
export function PartnerProfileCard({
  baseUrl,
  slug,
  headline,
  bio,
  photoUrl,
}: {
  baseUrl: string;
  slug: string;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [headlineValue, setHeadlineValue] = useState(headline ?? "");
  const [bioValue, setBioValue] = useState(bio ?? "");
  const [photoValue, setPhotoValue] = useState(photoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const publicUrl = `${baseUrl}/partners/${slug}`;
  const display = publicUrl.replace(/^https?:\/\//, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  function save() {
    startTransition(async () => {
      const res = await updatePartnerProfileAction({
        display_headline: headlineValue,
        bio: bioValue,
        photo_url: photoValue,
      });
      if (res.ok) {
        toast.success("Your partner page is updated.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="border-b border-brand-line p-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          <UserRound className="h-3.5 w-3.5 text-brand-primary" />
          Your partner page
        </div>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-mute">
          A co-branded landing page you can share. Every host who starts through
          it earns you recurring commission.
        </p>

        {/* Public link + copy/view */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[11px] border border-brand-accent bg-brand-light pl-4 pr-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-brand-ink">
              {display}
            </span>
            <button
              onClick={copy}
              className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-brand-primary px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[11px] border border-brand-line bg-white px-4 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View
          </a>
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-4 p-5">
        <div>
          <label className="block text-[12.5px] font-semibold text-brand-ink">
            Headline
          </label>
          <input
            value={headlineValue}
            onChange={(e) => setHeadlineValue(e.target.value)}
            maxLength={80}
            placeholder="Run your place on Wielo, commission-free"
            className="mt-1.5 w-full rounded-[11px] border border-brand-line bg-brand-light px-3.5 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-accent"
          />
          <p className="mt-1 text-[11px] text-brand-mute">
            {headlineValue.length}/80 · shown as the big title on your page.
          </p>
        </div>

        <div>
          <label className="block text-[12.5px] font-semibold text-brand-ink">
            About you
          </label>
          <textarea
            value={bioValue}
            onChange={(e) => setBioValue(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="A short note to the hosts you're inviting."
            className="mt-1.5 w-full resize-y rounded-[11px] border border-brand-line bg-brand-light px-3.5 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-accent"
          />
          <p className="mt-1 text-[11px] text-brand-mute">
            {bioValue.length}/400 · optional.
          </p>
        </div>

        <div>
          <label className="block text-[12.5px] font-semibold text-brand-ink">
            Your photo
          </label>
          <div className="mt-1.5 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-line bg-brand-light">
              {photoValue ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoValue}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-5 w-5 text-brand-mute" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={uploading}
                  className="text-[12.5px] font-semibold text-brand-primary hover:underline disabled:opacity-60"
                >
                  {uploading
                    ? "Uploading…"
                    : photoValue
                      ? "Change photo"
                      : "Upload a photo"}
                </button>
                {photoValue ? (
                  <button
                    type="button"
                    onClick={() => setPhotoValue("")}
                    className="text-[12.5px] font-semibold text-brand-mute hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-brand-mute">
                Shown on your partner page and the race standings. Max 5MB.
                Leave blank to show your initial instead.
              </p>
            </div>
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error("Image is too large — max 5MB.");
                return;
              }
              // Uploaded straight away so the preview shows the REAL stored
              // image, not a blob that would vanish on save.
              setUploading(true);
              const fd = new FormData();
              fd.append("file", file);
              uploadPartnerPhotoAction(fd)
                .then((res) => {
                  if (res.ok && res.data) setPhotoValue(res.data.url);
                  else if (!res.ok) toast.error(res.error);
                })
                .finally(() => setUploading(false));
            }}
          />
        </div>

        <button
          onClick={save}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {pending ? "Saving…" : "Save partner page"}
        </button>
      </div>
    </div>
  );
}
