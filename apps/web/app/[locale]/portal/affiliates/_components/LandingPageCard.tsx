"use client";

import { Check, ExternalLink, ImageUp, Info } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadPartnerPhotoAction } from "@/app/[locale]/signup/partner/actions";

import { updatePartnerProfileAction } from "../actions";

// The three things a partner controls on their own landing page: their picture,
// their message, and a phone number. Everything else on that page — their name,
// community, region, the offer, the campaign — is pulled from their profile and
// the campaign config, so there is nothing here that can put a wrong claim in
// front of a host.

const MAX_BYTES = 5 * 1024 * 1024;
const MESSAGE_MAX = 400;

export function LandingPageCard({
  slug,
  headline,
  bio,
  photoUrl,
  publicPhone,
}: {
  slug: string;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  publicPhone: string | null;
}) {
  const [message, setMessage] = useState(bio ?? "");
  const [photo, setPhoto] = useState(photoUrl ?? "");
  const [phone, setPhone] = useState(publicPhone ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const pageHref = `/partners/${slug}`;

  function save() {
    startTransition(async () => {
      const res = await updatePartnerProfileAction({
        display_headline: headline ?? "",
        bio: message,
        photo_url: photo,
        public_phone: phone,
      });
      if (res.ok) toast.success("Your landing page is updated.");
      else toast.error(res.error);
    });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Image is too large — 5MB maximum.");
      return;
    }
    // Uploaded immediately so the preview shows the REAL stored image rather
    // than a blob URL that would vanish the moment the page reloads.
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    uploadPartnerPhotoAction(fd)
      .then((res) => {
        if (res.ok && res.data) setPhoto(res.data.url);
        else if (!res.ok) toast.error(res.error);
      })
      .finally(() => setUploading(false));
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-bold text-brand-ink">
            Your landing page
          </h2>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-brand-mute">
            The page hosts land on when they follow your link. Your name,
            community and the current offer fill themselves in — these three
            things are yours to set.
          </p>
        </div>
        <a
          href={pageHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border border-brand-line px-4 text-[12.5px] font-semibold text-brand-ink no-underline hover:border-brand-primary"
        >
          View my page <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* Photo */}
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
            Your picture
          </span>
          <div className="overflow-hidden rounded-card border border-brand-line bg-brand-light">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt="Your landing page picture"
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center text-[12px] text-brand-mute">
                No picture yet
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-pill border border-brand-line px-4 text-[12.5px] font-semibold text-brand-ink hover:border-brand-primary disabled:opacity-60"
          >
            <ImageUp className="h-4 w-4" />
            {uploading ? "Uploading…" : photo ? "Change picture" : "Upload"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPick}
          />

          {/* Concrete guidance. "A good photo" helps nobody. */}
          <div className="mt-3 rounded-card border border-brand-line bg-brand-light/60 p-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-ink">
              <Info className="h-3.5 w-3.5 text-brand-primary" /> Picture guide
            </div>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-brand-mute">
              <li>
                <strong>900 × 1200px</strong> or larger (portrait, 3:4).
              </li>
              <li>JPG, PNG or WebP · under 5MB.</li>
              <li>
                It is cropped to a <strong>tall panel</strong> — keep your face
                in the upper middle and leave room at the bottom, where your
                name sits.
              </li>
              <li>
                A clear, well-lit photo of <strong>you</strong> works better
                than a logo. Hosts are deciding whether to trust a person.
              </li>
            </ul>
          </div>
        </div>

        {/* Message + phone */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="lp-message"
              className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink"
            >
              Your message
            </label>
            <textarea
              id="lp-message"
              value={message}
              maxLength={MESSAGE_MAX}
              rows={5}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why you moved to Wielo, and why the hosts you know should too. Written in your own words — it appears in quotation marks, signed with your name."
              className="w-full rounded-[11px] border border-brand-line px-3.5 py-2.5 text-[14px] leading-relaxed text-brand-ink outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-brand-primary/15"
            />
            <p className="mt-1 text-[11.5px] text-brand-mute">
              {message.length}/{MESSAGE_MAX} · Two or three sentences reads
              best. Leave it blank and the page uses a general invitation
              instead.
            </p>
          </div>

          <div>
            <label
              htmlFor="lp-phone"
              className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink"
            >
              Phone number{" "}
              <span className="font-normal text-brand-mute">(optional)</span>
            </label>
            <input
              id="lp-phone"
              value={phone}
              maxLength={24}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="071 234 5678"
              className="h-[46px] w-full rounded-[11px] border border-brand-line px-3.5 text-[14px] text-brand-ink outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-brand-primary/15"
            />
            <p className="mt-1 text-[11.5px] leading-relaxed text-brand-mute">
              Shown publicly, with a tap-to-call button. This is separate from
              your account number on purpose — only what you type here is
              published. Leave it blank and the page simply shows no phone at
              all.
            </p>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={pending || uploading}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {pending ? "Saving…" : "Save my page"}
          </button>
        </div>
      </div>
    </section>
  );
}
