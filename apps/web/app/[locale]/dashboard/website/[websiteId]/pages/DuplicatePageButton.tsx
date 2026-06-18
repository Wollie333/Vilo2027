"use client";

import { Copy, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { duplicatePageAction } from "@/app/[locale]/dashboard/website/actions";

/** Duplicates a page and opens the new copy in the builder. */
export function DuplicatePageButton({
  websiteId,
  pageId,
}: {
  websiteId: string;
  pageId: string;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await duplicatePageAction(websiteId, pageId);
      if (!res.ok) {
        toast.error(t("duplicateError"));
        return;
      }
      toast.success(t("pageDuplicated"));
      router.push(`/dashboard/website/${websiteId}/pages/${res.id}`);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={t("duplicatePage")}
      className="shrink-0 rounded-[10px] border border-brand-line bg-white p-2.5 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
