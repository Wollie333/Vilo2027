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
import { busy } from "@/components/ui/busy-host";
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
      const res = await busy.during(
        { title: t("publishingSite"), message: t("publishingSiteMsg") },
        () => publishWebsiteAction(websiteId),
      );
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
    <div className="wielo-cms flex items-center gap-2.5">
      <span
        className="hidden items-center gap-1.5 text-[12px] font-medium md:inline-flex"
        style={{
          color:
            isLive && !isDirty ? "#4A7C6A" : isDirty ? "#B45309" : "#4A7C6A",
        }}
      >
        <Dot
          className="h-5 w-5"
          style={{
            color:
              isLive && !isDirty ? "#10B981" : isDirty ? "#F59E0B" : "#9DB4A8",
          }}
        />
        {statusLabel}
      </span>

      {isLive ? (
        <button
          type="button"
          onClick={onTakeOffline}
          disabled={offline}
          className="btn btn-ghost btn-sm"
        >
          {t("takeOfflineCta")}
        </button>
      ) : null}

      <button
        type="button"
        onClick={onPublish}
        disabled={publishing || (isLive && !isDirty)}
        title={isLive && !isDirty ? t("allPublished") : undefined}
        className="btn btn-primary btn-sm"
        style={{ cursor: isLive && !isDirty ? "not-allowed" : undefined }}
      >
        {publishing ? (
          <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} />
        ) : isLive && !isDirty ? (
          <Check style={{ width: 15, height: 15 }} />
        ) : (
          <Rocket style={{ width: 15, height: 15 }} />
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
