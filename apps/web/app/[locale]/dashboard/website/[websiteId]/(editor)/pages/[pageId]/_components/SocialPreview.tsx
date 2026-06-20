"use client";

import { ImageIcon } from "lucide-react";

import { useTranslations } from "next-intl";

/**
 * How the page looks when shared on Facebook/LinkedIn/X — a 1.91:1 OG card with
 * the share image, domain, title and description. Purely presentational; reuses
 * the effective SEO title/description the host is already editing.
 */
export function SocialPreview({
  title,
  description,
  domain,
  imageUrl,
}: {
  title: string;
  description: string;
  domain?: string;
  imageUrl?: string;
}) {
  const t = useTranslations("website");

  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
        {t("socialPreviewTitle")}
      </p>
      <div className="overflow-hidden rounded-[10px] border border-brand-line">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="aspect-[1.91/1] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-brand-light/60 text-brand-mute">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <div className="border-t border-brand-line bg-white px-3 py-2">
          {domain ? (
            <p className="truncate text-[11px] uppercase text-brand-mute">
              {domain}
            </p>
          ) : null}
          <p className="truncate text-[13.5px] font-semibold text-brand-ink">
            {title}
          </p>
          <p className="line-clamp-2 text-[12px] text-brand-mute">
            {description}
          </p>
        </div>
      </div>
      {!imageUrl ? (
        <p className="mt-1 text-[11px] text-brand-mute">{t("socialNoImage")}</p>
      ) : null}
    </div>
  );
}
