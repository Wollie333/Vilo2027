"use client";

import {
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  type LucideIcon,
  Mail,
  MessageSquareQuote,
  Sparkles,
  Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type LibraryAsset = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  body: string | null;
  link_url: string | null;
  file_url: string | null;
  mime_type: string | null;
  width: number | null;
};

type Category = "banner" | "social" | "email" | "prompt" | "video" | "blog";

const SECTIONS: {
  key: Category;
  label: string;
  icon: LucideIcon;
  blurb: string;
}[] = [
  {
    key: "banner",
    label: "Banners",
    icon: ImageIcon,
    blurb: "Download or embed — your link wraps the image.",
  },
  {
    key: "email",
    label: "Email templates",
    icon: Mail,
    blurb: "Copy, paste, send. Your link is baked in.",
  },
  {
    key: "social",
    label: "Social posts",
    icon: MessageSquareQuote,
    blurb: "Ready-to-paste captions for any channel.",
  },
  {
    key: "prompt",
    label: "AI prompts",
    icon: Sparkles,
    blurb: "Paste into your favourite AI writer.",
  },
  {
    key: "video",
    label: "Videos",
    icon: Video,
    blurb: "Share these clips with your link.",
  },
  {
    key: "blog",
    label: "Blogs",
    icon: FileText,
    blurb: "Articles worth sharing.",
  },
];

export function MarketingLibrary({
  assets,
  referralLink,
}: {
  assets: LibraryAsset[];
  referralLink: string;
}) {
  // Substitute the affiliate's link into admin copy — admins write {link}.
  const withLink = (text: string | null) =>
    (text ?? "").replaceAll("{link}", referralLink);

  const present = SECTIONS.filter((s) =>
    assets.some((a) => a.category === s.key),
  );

  if (present.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
        No marketing material has been published yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="space-y-9">
      <p className="max-w-2xl text-[13.5px] leading-relaxed text-brand-mute">
        Ready-made assets from the Vilo team. Your affiliate link is already
        baked into every template — copy, paste, and you&apos;re marketing.
      </p>

      {present.map((s) => {
        const Icon = s.icon;
        const rows = assets.filter((a) => a.category === s.key);
        return (
          <section key={s.key}>
            <div className="flex items-center gap-2">
              <Icon className="h-[18px] w-[18px] text-brand-primary" />
              <h2 className="font-display text-[16px] font-bold text-brand-ink">
                {s.label}
              </h2>
              <span className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand-mute">
                {rows.length}
              </span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-brand-mute">{s.blurb}</p>

            <div
              className={`mt-3 grid gap-3.5 ${
                s.key === "email" || s.key === "blog"
                  ? "lg:grid-cols-2"
                  : "sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {rows.map((a) =>
                s.key === "banner" ? (
                  <BannerCard
                    key={a.id}
                    asset={a}
                    referralLink={referralLink}
                  />
                ) : (
                  <TextCard
                    key={a.id}
                    asset={a}
                    category={s.key}
                    text={withLink(a.body)}
                    referralLink={referralLink}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string, msg = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(msg);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  };
  return { copied, copy };
}

function BannerCard({
  asset,
  referralLink,
}: {
  asset: LibraryAsset;
  referralLink: string;
}) {
  const { copy } = useCopy();
  const isImage =
    (asset.mime_type ?? "").startsWith("image/") && asset.file_url;
  const embed = `<a href="${referralLink}" target="_blank" rel="noopener"><img src="${asset.file_url ?? ""}" alt="${asset.title.replace(/"/g, "&quot;")}"${
    asset.width ? ` width="${asset.width}"` : ""
  } style="max-width:100%;height:auto;border:0" /></a>`;

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-brand-light">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.file_url ?? ""}
            alt={asset.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <ImageIcon className="h-7 w-7 text-brand-mute" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-[13px] font-semibold text-brand-ink">
          {asset.title}
        </div>
        {asset.description ? (
          <p className="mt-0.5 text-[12px] text-brand-mute">
            {asset.description}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          {asset.file_url ? (
            <a
              href={asset.file_url}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          ) : null}
          {asset.file_url ? (
            <button
              onClick={() => copy(embed, "Embed code copied")}
              className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
            >
              <Code2 className="h-3.5 w-3.5" /> Embed
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TextCard({
  asset,
  category,
  text,
  referralLink,
}: {
  asset: LibraryAsset;
  category: Category;
  text: string;
  referralLink: string;
}) {
  const { copy } = useCopy();
  const link = asset.link_url
    ? asset.link_url.replaceAll("{link}", referralLink)
    : null;
  // What the affiliate copies: emails get subject + body; others get the body.
  const copyText =
    category === "email" ? `${asset.title}\n\n${text}` : text || referralLink;
  const copyLabel =
    category === "email"
      ? "Copy email"
      : category === "prompt"
        ? "Copy prompt"
        : category === "social"
          ? "Copy caption"
          : "Copy";

  return (
    <article className="flex flex-col rounded-card border border-brand-line bg-white p-4 shadow-card">
      {category === "email" ? (
        <>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            <Mail className="h-3.5 w-3.5 text-brand-primary" /> Subject
          </div>
          <div className="mt-1 text-[13.5px] font-semibold text-brand-ink">
            {asset.title}
          </div>
        </>
      ) : (
        <div className="text-[13px] font-semibold text-brand-ink">
          {asset.title}
        </div>
      )}

      {asset.description && category !== "email" ? (
        <p className="mt-0.5 text-[12px] text-brand-mute">
          {asset.description}
        </p>
      ) : null}

      {text ? (
        <pre className="thin-scroll mt-2.5 max-h-44 flex-1 overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-brand-line bg-[#FAFCFB] p-3 font-sans text-[12px] leading-relaxed text-brand-ink">
          {text}
        </pre>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(text || category !== "blog") && (text || copyText) ? (
          <button
            onClick={() => copy(copyText, "Copied to clipboard")}
            className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Copy className="h-3.5 w-3.5" /> {copyLabel}
          </button>
        ) : null}
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
          >
            {category === "video"
              ? "Watch"
              : category === "blog"
                ? "Read"
                : "Open"}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
