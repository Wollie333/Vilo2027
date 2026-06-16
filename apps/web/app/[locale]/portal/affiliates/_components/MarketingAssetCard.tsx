"use client";

import { Check, Code2, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Asset = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
};

export function MarketingAssetCard({
  asset,
  referralLink,
}: {
  asset: Asset;
  referralLink: string;
}) {
  const [copied, setCopied] = useState(false);
  const isImage = (asset.mime_type ?? "").startsWith("image/");

  // Ready-to-paste HTML: the affiliate's link wrapped around the banner image.
  const embed = `<a href="${referralLink}" target="_blank" rel="noopener"><img src="${asset.file_url}" alt="${asset.title.replace(/"/g, "&quot;")}"${
    asset.width ? ` width="${asset.width}"` : ""
  } style="max-width:100%;height:auto;border:0" /></a>`;

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-brand-light">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.file_url}
            alt={asset.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs font-medium uppercase tracking-wider text-brand-mute">
            {asset.category}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            {asset.category}
          </span>
        </div>
        <div className="mt-1.5 font-display text-sm font-semibold text-brand-ink">
          {asset.title}
        </div>
        {asset.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-brand-mute">
            {asset.description}
          </p>
        ) : null}

        <div className="mt-3 flex gap-2 pt-1">
          <a
            href={asset.file_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-brand-line bg-white px-3 py-2 text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          {isImage ? (
            <button
              onClick={copyEmbed}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-secondary"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Code2 className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy embed"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
