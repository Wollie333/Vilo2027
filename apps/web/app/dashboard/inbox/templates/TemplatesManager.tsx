"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { modal } from "@/components/ui/modal-host";

import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "../actions";

export type Template = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
};

export function TemplatesManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(t: Template) {
    setEditing(t);
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
      sort_order: editing?.sort_order ?? templates.length,
    };
    setBusy(true);
    const res = editing
      ? await updateTemplateAction(editing.id, input)
      : await createTemplateAction(input);
    setBusy(false);
    if (!res.ok) {
      void modal.error({ title: "Couldn't save", description: res.error });
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove(t: Template) {
    const ok = await modal.destructive({
      title: `Delete “${t.title}”?`,
      description: "This template will be removed everywhere it's offered.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await deleteTemplateAction(t.id);
    if (!res.ok) {
      void modal.error({ title: "Couldn't delete", description: res.error });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-16 text-center text-[13px] text-brand-mute">
          No templates yet. Create your first reusable reply.
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group flex items-start gap-3 rounded-card border border-brand-line bg-white p-4 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-brand-ink">
                  {t.title}
                </div>
                <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-[12.5px] text-brand-mute">
                  {t.body}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => openEdit(t)}
                  title="Edit"
                  className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void remove(t)}
                  title="Delete"
                  className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit template" : "New template"}
      >
        <form id="template-form" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              className="mb-1 block text-[12.5px] font-semibold text-brand-ink"
              htmlFor="t-title"
            >
              Title
            </label>
            <input
              id="t-title"
              name="title"
              defaultValue={editing?.title ?? ""}
              required
              maxLength={60}
              autoFocus
              placeholder="e.g. Check-in details"
              className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-[12.5px] font-semibold text-brand-ink"
              htmlFor="t-body"
            >
              Body
            </label>
            <textarea
              id="t-body"
              name="body"
              defaultValue={editing?.body ?? ""}
              required
              rows={7}
              maxLength={2000}
              placeholder="Hi {{guest_name}}, …"
              className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
            <p className="mt-1 text-[11.5px] text-brand-mute">
              Tokens: {"{{guest_name}}"}, {"{{listing_name}}"}, {"{{check_in}}"}
              , {"{{check_out}}"}.
            </p>
          </div>
        </form>
        <FormModalFooter>
          <FormModalCancel disabled={busy}>Cancel</FormModalCancel>
          <button
            type="submit"
            form="template-form"
            disabled={busy}
            className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save template"}
          </button>
        </FormModalFooter>
      </FormModal>
    </div>
  );
}
