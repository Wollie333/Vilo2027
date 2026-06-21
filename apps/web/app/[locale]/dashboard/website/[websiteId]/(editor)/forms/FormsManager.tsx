"use client";

import {
  ChevronDown,
  ChevronUp,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  createWebsiteFormAction,
  deleteWebsiteFormAction,
  saveWebsiteFormAction,
} from "@/app/[locale]/dashboard/website/actions";
import {
  FORM_FIELD_TYPES,
  FORM_TYPES,
  type FormField,
  type FormFieldType,
  type FormType,
} from "@/lib/website/forms.schema";

import {
  SelectField,
  TextArea,
  TextField,
  ToggleField,
} from "../pages/[pageId]/_components/fields";
import type { FormEditorRow } from "./loadFormsEditor";

const TYPE_ICON: Record<FormType, typeof Mail> = {
  contact: Mail,
  custom: FileText,
  newsletter: Inbox,
};

export function FormsManager({
  websiteId,
  initialForms,
  preselectId,
}: {
  websiteId: string;
  initialForms: FormEditorRow[];
  preselectId?: string;
}) {
  const t = useTranslations("website");
  const [forms, setForms] = useState<FormEditorRow[]>(initialForms);
  const [selectedId, setSelectedId] = useState<string | null>(
    preselectId ?? initialForms[0]?.id ?? null,
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [creating, startCreate] = useTransition();
  const [saving, startSave] = useTransition();

  const selected = forms.find((f) => f.id === selectedId) ?? null;

  function patchSelected(patch: Partial<FormEditorRow>) {
    if (!selectedId) return;
    setForms((prev) =>
      prev.map((f) => (f.id === selectedId ? { ...f, ...patch } : f)),
    );
    setDirty((prev) => new Set(prev).add(selectedId));
  }

  function setFields(updater: (fields: FormField[]) => FormField[]) {
    if (!selected) return;
    patchSelected({ fields: updater(selected.fields) });
  }

  function handleCreate() {
    startCreate(async () => {
      const res = await createWebsiteFormAction({
        websiteId,
        name: t("formsDefaultName"),
        type: "contact",
      });
      if (!res.ok) {
        toast.error(t("formsCreateError"));
        return;
      }
      const fresh: FormEditorRow = {
        id: res.id,
        name: t("formsDefaultName"),
        type: "contact",
        fields: [],
        settings: {
          description: "",
          submitLabel: "Send",
          successMessage:
            "Thanks — your message is on its way. We'll be in touch soon.",
          notifyInbox: true,
        },
        submissionCount: 0,
        status: "draft",
        embedLabels: [],
        submissionsThisMonth: 0,
        lastSubmissionAt: null,
      };
      setForms((prev) => [...prev, fresh]);
      setSelectedId(res.id);
    });
  }

  function handleSave() {
    if (!selected) return;
    if (selected.fields.length === 0) {
      toast.error(t("formsNeedField"));
      return;
    }
    // Drop blank choices (the options textarea can leave empty lines) so the
    // payload passes the schema's per-option min-length rule.
    const cleanFields = selected.fields.map((f) =>
      f.type === "select"
        ? {
            ...f,
            options: (f.options ?? []).filter((o) => o.trim().length > 0),
          }
        : f,
    );
    startSave(async () => {
      const res = await saveWebsiteFormAction({
        websiteId,
        formId: selected.id,
        name: selected.name,
        type: selected.type,
        fields: cleanFields,
        settings: selected.settings,
      });
      if (!res.ok) {
        toast.error(t("formsSaveError"));
        return;
      }
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(selected.id);
        return next;
      });
      toast.success(t("formsSaved"));
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t("formsDeleteConfirm"))) return;
    startSave(async () => {
      const res = await deleteWebsiteFormAction({ websiteId, formId: id });
      if (!res.ok) {
        toast.error(t("formsDeleteError"));
        return;
      }
      setForms((prev) => prev.filter((f) => f.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success(t("formsDeleted"));
    });
  }

  function addField(type: FormFieldType) {
    setFields((fields) => [
      ...fields,
      {
        id: crypto.randomUUID(),
        type,
        label: t(`fieldType_${type}`),
        required: false,
        width: "full",
        ...(type === "select" ? { options: [t("formsOption")] } : {}),
      },
    ]);
  }

  function patchField(id: string, patch: Partial<FormField>) {
    setFields((fields) =>
      fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  function removeField(id: string) {
    setFields((fields) => fields.filter((f) => f.id !== id));
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((fields) => {
      const next = [...fields];
      const target = index + dir;
      if (target < 0 || target >= next.length) return fields;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      {/* Forms list */}
      <aside className="space-y-2">
        {forms.map((f) => {
          const Icon = TYPE_ICON[f.type];
          const active = f.id === selectedId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={`flex w-full items-start gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-brand-primary bg-brand-light/60"
                  : "border-brand-line bg-white hover:bg-brand-light/40"
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-mute" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-brand-ink">
                  {f.name}
                  {dirty.has(f.id) ? (
                    <span className="ml-1 text-brand-primary">•</span>
                  ) : null}
                </span>
                <span className="block text-[12px] text-brand-mute">
                  {t("formsFieldCount", { count: f.fields.length })} ·{" "}
                  {t("formsResponseCount", { count: f.submissionCount })}
                </span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-brand-line bg-white px-3 py-2.5 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("formsNew")}
        </button>
      </aside>

      {/* Builder */}
      {selected ? (
        <section className="space-y-6">
          <div className="space-y-4 rounded-[14px] border border-brand-line bg-white p-5">
            <TextField
              label={t("formsName")}
              value={selected.name}
              maxLength={120}
              onChange={(v) => patchSelected({ name: v })}
            />
            <SelectField<FormType>
              label={t("formsType")}
              value={selected.type}
              options={FORM_TYPES.map((tp) => ({
                value: tp,
                label: t(`formType_${tp}`),
              }))}
              onChange={(v) => patchSelected({ type: v })}
            />
            <p className="text-[12.5px] text-brand-mute">
              {t(`formTypeHint_${selected.type}`)}
            </p>
          </div>

          {/* Fields */}
          <div className="space-y-3 rounded-[14px] border border-brand-line bg-white p-5">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-brand-mute">
              {t("formsFields")}
            </h3>

            {selected.fields.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-4 text-center text-[13px] text-brand-mute">
                {t("formsNoFields")}
              </p>
            ) : (
              <ul className="space-y-3">
                {selected.fields.map((field, i) => (
                  <li
                    key={field.id}
                    className="rounded-[12px] border border-brand-line bg-brand-light/30 p-3.5"
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-mute ring-1 ring-brand-line">
                        {t(`fieldType_${field.type}`)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveField(i, -1)}
                          disabled={i === 0}
                          aria-label={t("moveUp")}
                          className="rounded-md p-1 text-brand-mute hover:bg-white disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(i, 1)}
                          disabled={i === selected.fields.length - 1}
                          aria-label={t("moveDown")}
                          className="rounded-md p-1 text-brand-mute hover:bg-white disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          aria-label={t("delete")}
                          className="rounded-md p-1 text-brand-mute hover:bg-white hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        label={t("formsFieldLabel")}
                        value={field.label}
                        maxLength={120}
                        onChange={(v) => patchField(field.id, { label: v })}
                      />
                      {field.type !== "checkbox" ? (
                        <TextField
                          label={t("formsFieldPlaceholder")}
                          value={field.placeholder ?? ""}
                          maxLength={160}
                          onChange={(v) =>
                            patchField(field.id, { placeholder: v })
                          }
                        />
                      ) : null}
                    </div>

                    {field.type === "select" ? (
                      <div className="mt-3">
                        <TextArea
                          label={t("formsFieldOptions")}
                          hint={t("formsFieldOptionsHint")}
                          rows={3}
                          value={(field.options ?? []).join("\n")}
                          onChange={(v) =>
                            patchField(field.id, {
                              options: v.split("\n").map((o) => o.trim()),
                            })
                          }
                        />
                      </div>
                    ) : null}

                    <div className="mt-3">
                      <ToggleField
                        label={t("formsFieldRequired")}
                        checked={field.required}
                        onChange={(v) => patchField(field.id, { required: v })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Add-field menu */}
            <div className="flex flex-wrap gap-2 pt-1">
              {FORM_FIELD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addField(type)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink transition-colors hover:bg-brand-light"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t(`fieldType_${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4 rounded-[14px] border border-brand-line bg-white p-5">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-brand-mute">
              {t("formsSettings")}
            </h3>
            <TextField
              label={t("formsSubmitLabel")}
              value={selected.settings.submitLabel}
              maxLength={60}
              onChange={(v) =>
                patchSelected({
                  settings: { ...selected.settings, submitLabel: v },
                })
              }
            />
            <TextArea
              label={t("formsSuccessMessage")}
              value={selected.settings.successMessage}
              maxLength={300}
              rows={2}
              onChange={(v) =>
                patchSelected({
                  settings: { ...selected.settings, successMessage: v },
                })
              }
            />
            {selected.type !== "newsletter" ? (
              <ToggleField
                label={t("formsNotifyInbox")}
                checked={selected.settings.notifyInbox}
                onChange={(v) =>
                  patchSelected({
                    settings: { ...selected.settings, notifyInbox: v },
                  })
                }
              />
            ) : null}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleDelete(selected.id)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute transition-colors hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                {t("formsDelete")}
              </button>
              <Link
                href={`/dashboard/website/${websiteId}/forms/responses?form=${selected.id}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute transition-colors hover:text-brand-ink"
              >
                <Inbox className="h-4 w-4" />
                {t("formsViewResponses", { count: selected.submissionCount })}
              </Link>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty.has(selected.id)}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("formsSave")}
            </button>
          </div>
        </section>
      ) : (
        <section className="flex min-h-[240px] items-center justify-center rounded-[14px] border border-dashed border-brand-line bg-white p-8 text-center">
          <p className="max-w-xs text-sm text-brand-mute">{t("formsEmpty")}</p>
        </section>
      )}
    </div>
  );
}
