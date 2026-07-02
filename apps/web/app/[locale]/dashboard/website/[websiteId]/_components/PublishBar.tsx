"use client";

import { Check, Dot, Loader2, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  checkWebsiteReadinessAction,
  publishWebsiteAction,
  unpublishWebsiteAction,
} from "@/app/[locale]/dashboard/website/actions";
import { ReadinessChecklist } from "@/app/[locale]/dashboard/website/_components/ReadinessChecklist";
import { busy } from "@/components/ui/busy-host";
import { modal } from "@/components/ui/modal-host";
import type { ReadinessItem } from "@/lib/website/readiness";

/**
 * Publish control in the editor header (W10). Shows the live/draft status,
 * publishes the draft (copy + snapshot), and can take a live site offline.
 *
 * Go-live readiness gate (Phase 6): a site can't publish until the hard-required
 * set is met. This is the "exciting moment" wall — when the site isn't ready the
 * Publish button opens a checklist of what's left (with fix links) instead of
 * failing silently. `checkWebsiteReadinessAction` and the server-side gate in
 * `publishWebsiteAction` share the same SSOT, so the button never disagrees with
 * the backstop.
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
  const [missing, setMissing] = useState<ReadinessItem[] | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isLive = status === "published";
  const notReady = missing !== null && missing.length > 0;

  const refreshReadiness = useCallback(async () => {
    const res = await checkWebsiteReadinessAction(websiteId);
    if (res.ok) setMissing(res.missing);
  }, [websiteId]);

  // Load readiness on mount and whenever the draft changes (an edit might add or
  // remove a required piece — e.g. saving a room or a payment method elsewhere).
  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness, isDirty, status]);

  // Close the checklist popover on outside click.
  useEffect(() => {
    if (!showChecklist) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setShowChecklist(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showChecklist]);

  function onPublish() {
    // Not ready → don't attempt; show the host exactly what's left.
    if (notReady) {
      setShowChecklist(true);
      return;
    }
    startPublish(async () => {
      const res = await busy.during(
        { title: t("publishingSite"), message: t("publishingSiteMsg") },
        () => publishWebsiteAction(websiteId),
      );
      if (!res.ok) {
        if (res.error === "not_ready") {
          // Readiness changed under us (backstop tripped) — refresh + reveal.
          await refreshReadiness();
          setShowChecklist(true);
          toast.error(t("publishNotReady"));
          return;
        }
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

  const publishDisabled = publishing || (isLive && !isDirty);

  return (
    <div ref={wrapRef} className="wielo-cms relative flex items-center gap-2.5">
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
        disabled={publishDisabled}
        title={isLive && !isDirty ? t("allPublished") : undefined}
        className="btn btn-primary btn-sm"
        style={{
          cursor: isLive && !isDirty ? "not-allowed" : undefined,
          ...(notReady && !isLive
            ? { backgroundColor: "#B45309", borderColor: "#B45309" }
            : {}),
        }}
      >
        {publishing ? (
          <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} />
        ) : isLive && !isDirty ? (
          <Check style={{ width: 15, height: 15 }} />
        ) : (
          <Rocket style={{ width: 15, height: 15 }} />
        )}
        {notReady && !isLive
          ? t("goLiveCta")
          : isLive
            ? isDirty
              ? t("publishChangesCta")
              : t("publishedCta")
            : t("publishCta")}
        {notReady && !isLive ? (
          <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold leading-none">
            {missing.length}
          </span>
        ) : null}
      </button>

      {showChecklist && missing ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-card border border-brand-line bg-white p-4 shadow-xl">
          <ReadinessChecklist
            missing={missing}
            onFixNavigate={() => setShowChecklist(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
