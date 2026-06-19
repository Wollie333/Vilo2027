"use client";

import {
  History,
  Loader2,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  deleteRestorePointAction,
  resetToDefaultAction,
  restoreRestorePointAction,
  saveRestorePointAction,
} from "@/app/[locale]/dashboard/website/actions";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import type { RestorePointMeta } from "@/lib/website/restorePoints";

import { bsInput } from "../../brand/_ui";

export function SavedDesigns({
  websiteId,
  restorePoints,
}: {
  websiteId: string;
  restorePoints: RestorePointMeta[];
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<RestorePointMeta | null>(
    null,
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, start] = useTransition();

  function fmtDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    // Use a consistent format to avoid server/client hydration mismatch
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${mins}`;
  }

  function onSave() {
    start(async () => {
      const res = await saveRestorePointAction({ websiteId, label });
      if (!res.ok) {
        toast.error(t("designSaveError"));
        return;
      }
      toast.success(t("designSaved"));
      setSaveOpen(false);
      setLabel("");
      router.refresh();
    });
  }

  function onRestore() {
    if (!restoreTarget) return;
    const id = restoreTarget.id;
    start(async () => {
      const res = await restoreRestorePointAction({ restorePointId: id });
      if (!res.ok) {
        toast.error(t("restoreError"));
        return;
      }
      toast.success(t("restored"));
      setRestoreTarget(null);
      router.refresh();
    });
  }

  function onReset() {
    start(async () => {
      const res = await resetToDefaultAction({ websiteId });
      if (!res.ok) {
        toast.error(t("resetError"));
        return;
      }
      toast.success(t("resetDone"));
      setResetOpen(false);
      router.refresh();
    });
  }

  function onDelete(id: string) {
    start(async () => {
      const res = await deleteRestorePointAction({ restorePointId: id });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-light text-brand-primary">
          <History className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            {t("savedDesignsTitle")}
          </h3>
          <p className="text-[12.5px] text-brand-mute">
            {t("savedDesignsSub")}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Save className="h-4 w-4" />
            {t("saveDesign")}
          </button>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-red-600 transition hover:bg-red-50"
          >
            <ShieldAlert className="h-4 w-4" />
            {t("resetDefault")}
          </button>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-brand-line/70 border-t border-brand-line/70">
        {restorePoints.length === 0 ? (
          <li className="py-6 text-center text-sm text-brand-mute">
            {t("noSavedDesigns")}
          </li>
        ) : (
          restorePoints.map((rp) => (
            <li key={rp.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                  {rp.label ||
                    t("restorePointAuto", { theme: rp.themeSlug ?? "—" })}
                </div>
                <div className="text-[11.5px] text-brand-mute">
                  {fmtDate(rp.createdAt)}
                  {rp.kind === "auto_switch" ? ` · ${t("autoTag")}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTarget(rp)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("restore")}
              </button>
              <button
                type="button"
                onClick={() => onDelete(rp.id)}
                disabled={busy}
                aria-label={t("delete")}
                className="rounded-[8px] p-1.5 text-brand-mute transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))
        )}
      </ul>

      {/* Save current design */}
      <FormModal
        open={saveOpen}
        onOpenChange={(o) => !o && setSaveOpen(false)}
        title={t("saveDesignTitle")}
        description={t("saveDesignSub")}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder={t("saveDesignPlaceholder")}
          className={bsInput}
        />
        <FormModalFooter>
          <FormModalCancel>{t("cancel")}</FormModalCancel>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveDesign")}
          </button>
        </FormModalFooter>
      </FormModal>

      {/* Restore confirm */}
      <FormModal
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
        title={t("restoreTitle")}
        description={t("restoreWarning")}
      >
        <FormModalFooter>
          <FormModalCancel>{t("cancel")}</FormModalCancel>
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("restore")}
          </button>
        </FormModalFooter>
      </FormModal>

      {/* Reset to default confirm */}
      <FormModal
        open={resetOpen}
        onOpenChange={(o) => !o && setResetOpen(false)}
        title={t("resetDefaultTitle")}
        description={t("resetDefaultWarning")}
      >
        <FormModalFooter>
          <FormModalCancel>{t("cancel")}</FormModalCancel>
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("resetDefaultConfirm")}
          </button>
        </FormModalFooter>
      </FormModal>
    </div>
  );
}
