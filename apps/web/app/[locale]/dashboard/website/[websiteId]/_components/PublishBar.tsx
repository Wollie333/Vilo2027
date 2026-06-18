"use client";

import { Check, Dot, Loader2, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  publishWebsiteAction,
  unpublishWebsiteAction,
} from "@/app/[locale]/dashboard/website/actions";
import { modal } from "@/components/ui/modal-host";

/**
 * Publish control in the editor header (W10). Shows the live/draft status,
 * publishes the draft (copy + snapshot), and can take a live site offline.
 * Enabled only when there are unpublished changes.
 */
export function PublishBar({
  websiteId,
  status,
  isDirty,
}: {
  websiteId: string;
  status: "draft" | "published" | "unpublished";
  isDirty: boolean;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [publishing, startPublish] = useTransition();
  const [offline, startOffline] = useTransition();

  const isLive = status === "published";

  function onPublish() {
    startPublish(async () => {
      const res = await publishWebsiteAction(websiteId);
      if (!res.ok) {
        toast.error(t("publishError"));
        return;
      }
      toast.success(isLive ? t("changesPublished") : t("sitePublished"));
      router.refresh();
    });
  }

  function onTakeOffline() {
    startOffline(async () => {
      const ok = await modal.destructive({
        title: t("takeOfflineTitle"),
        description: t("takeOfflineBody"),
        confirmLabel: t("takeOfflineConfirm"),
      });
      if (!ok) return;
      const res = await unpublishWebsiteAction(websiteId);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("siteOffline"));
      router.refresh();
    });
  }

  const statusLabel = !isLive
    ? t("notPublishedYet")
    : isDirty
      ? t("unpublishedChanges")
      : t("allPublished");

  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center text-[12.5px] font-medium text-brand-mute">
        <Dot
          className={`h-5 w-5 ${
            isLive && !isDirty
              ? "text-emerald-500"
              : isDirty
                ? "text-amber-500"
                : "text-brand-mute/50"
          }`}
        />
        {statusLabel}
      </span>

      {isLive ? (
        <button
          type="button"
          onClick={onTakeOffline}
          disabled={offline}
          className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-mute transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          {t("takeOfflineCta")}
        </button>
      ) : null}

      <button
        type="button"
        onClick={onPublish}
        disabled={publishing || (isLive && !isDirty)}
        title={isLive && !isDirty ? t("allPublished") : undefined}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {publishing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isLive && !isDirty ? (
          <Check className="h-4 w-4" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        {isLive
          ? isDirty
            ? t("publishChangesCta")
            : t("publishedCta")
          : t("publishCta")}
      </button>
    </div>
  );
}
