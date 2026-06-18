"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

/** Copies the public site URL to the clipboard with a toast. */
export function CopyLinkButton({ url }: { url: string }) {
  const t = useTranslations("website");
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(url).catch(() => {});
        toast.success(t("ovLinkCopied"));
      }}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
    >
      <Copy className="h-4 w-4 text-brand-mute" />
      {t("ovCopyLink")}
    </button>
  );
}
