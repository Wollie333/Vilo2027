"use client";

import { Lock, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { savePersonalAddressAction } from "../actions";
import { AddressFields, type AddressValue } from "./AddressFields";

export function PersonalAddressCard({ initial }: { initial: AddressValue }) {
  const t = useTranslations("businesses");
  const [pending, start] = useTransition();
  const [v, setV] = useState<AddressValue>(initial);
  const hasData = Boolean(
    initial.address_line1 || initial.city || initial.postal_code,
  );
  const [editing, setEditing] = useState(!hasData);

  function patch(p: Partial<AddressValue>) {
    setV((prev) => ({ ...prev, ...p }));
  }

  function save() {
    start(async () => {
      const res = await savePersonalAddressAction(v);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("personalSaved"));
      setEditing(false);
    });
  }

  const summary = [v.address_line1, v.city, v.postal_code, v.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-light text-brand-mute">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              {t("personalTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-brand-mute">
              {t("personalSubtitle")}
            </p>
          </div>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-accent"
          >
            <Pencil className="h-3 w-3" /> {t("edit")}
          </button>
        ) : null}
      </div>

      {!editing ? (
        <p className="px-5 py-4 text-sm text-brand-ink">
          {summary || <span className="text-brand-mute">—</span>}
        </p>
      ) : (
        <div className="space-y-4 px-5 py-5">
          <AddressFields value={v} onChange={patch} />
          <div className="flex justify-end gap-2">
            {hasData ? (
              <button
                type="button"
                onClick={() => {
                  setV(initial);
                  setEditing(false);
                }}
                className="rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-light"
              >
                {t("cancel")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
            >
              {pending ? t("saving") : t("personalSave")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
