"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "../actions";

export type TemplateRow = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
};

type DialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; template: TemplateRow };

export function TemplatesManager({
  initialTemplates,
}: {
  initialTemplates: TemplateRow[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [pending, startTransition] = useTransition();

  function onSubmit(input: { title: string; body: string }) {
    startTransition(async () => {
      if (dialog.mode === "create") {
        const res = await createTemplateAction({
          title: input.title,
          body: input.body,
          sort_order: templates.length,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.data) {
          setTemplates((cur) => [
            ...cur,
            {
              id: res.data!.id,
              title: input.title.trim(),
              body: input.body.trim(),
              sortOrder: cur.length,
            },
          ]);
        }
        toast.success("Template saved");
        setDialog({ mode: "closed" });
      } else if (dialog.mode === "edit") {
        const res = await updateTemplateAction(dialog.template.id, {
          title: input.title,
          body: input.body,
          sort_order: dialog.template.sortOrder,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setTemplates((cur) =>
          cur.map((t) =>
            t.id === dialog.template.id
              ? { ...t, title: input.title.trim(), body: input.body.trim() }
              : t,
          ),
        );
        toast.success("Template updated");
        setDialog({ mode: "closed" });
      }
    });
  }

  function onDelete(t: TemplateRow) {
    if (!confirm(`Delete "${t.title}"? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteTemplateAction(t.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTemplates((cur) => cur.filter((x) => x.id !== t.id));
      toast.success("Template deleted");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-brand-mute">
          {templates.length === 0
            ? "No templates yet."
            : `${templates.length} ${templates.length === 1 ? "template" : "templates"}`}
        </div>
        <Button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState onCreate={() => setDialog({ mode: "create" })} />
      ) : (
        <ul className="divide-y divide-brand-line overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 p-4 transition-colors hover:bg-brand-light/40"
            >
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-semibold text-brand-ink">
                  {t.title}
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-brand-mute">
                  {t.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDialog({ mode: "edit", template: t })}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-mute hover:bg-brand-accent hover:text-brand-secondary"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(t)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-mute hover:bg-[#FEE2E2] hover:text-[#991B1B]"
                  title="Delete"
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplateDialog
        state={dialog}
        pending={pending}
        onClose={() => setDialog({ mode: "closed" })}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Plus className="h-6 w-6" />
      </div>
      <h2 className="font-display text-lg font-bold text-brand-ink">
        Save your first template
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
        Common ideas: confirming dates, check-in instructions, banking details,
        gentle decline. Templates appear as one-tap chips above the composer.
      </p>
      <Button type="button" onClick={onCreate} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" /> New template
      </Button>
    </div>
  );
}

function TemplateDialog({
  state,
  pending,
  onClose,
  onSubmit,
}: {
  state: DialogState;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; body: string }) => void;
}) {
  const isOpen = state.mode !== "closed";
  const initial =
    state.mode === "edit"
      ? state.template
      : { title: "", body: "", sortOrder: 0 };

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);

  // Reset fields when the dialog opens with a different state.
  const stateKey =
    state.mode === "edit" ? `edit:${state.template.id}` : state.mode;
  const lastKey = useStateKey(stateKey, () => {
    setTitle(initial.title);
    setBody(initial.body);
  });

  void lastKey;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "Edit template" : "New template"}
          </DialogTitle>
          <DialogDescription>
            Used as a one-tap quick reply in the inbox composer.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ title, body });
          }}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-title">Title</Label>
            <Input
              id="tmpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Confirm dates"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-body">Body</Label>
            <Textarea
              id="tmpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{guest_name}}, your dates are locked in for…"
              rows={6}
            />
            <p className="text-[11px] text-brand-mute">
              {`Variables coming soon: {{guest_name}}, {{listing_name}}, {{check_in}}, {{check_out}}.`}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !title.trim() || !body.trim()}
            >
              {pending
                ? "Saving…"
                : state.mode === "edit"
                  ? "Save changes"
                  : "Save template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Small helper: runs `onChange` when `key` changes between renders.
import { useEffect, useRef } from "react";
function useStateKey(key: string, onChange: () => void): string {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (prev.current !== key) {
      prev.current = key;
      onChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return key;
}
