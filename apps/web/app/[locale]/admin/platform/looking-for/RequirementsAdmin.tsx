"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  RequirementGroup,
  RequirementOption,
} from "@/lib/looking-for/requirements";

import {
  deleteRequirementGroup,
  deleteRequirementOption,
  saveRequirementGroup,
  saveRequirementOption,
} from "./actions";

type GroupForm = {
  id?: string;
  label: string;
  icon: string;
  selectMode: "single" | "multi";
  sortOrder: string;
  isPublished: boolean;
};

type OptionForm = {
  id?: string;
  groupId: string;
  label: string;
  icon: string;
  sortOrder: string;
  isPublished: boolean;
};

export function RequirementsAdmin({
  groups,
  options,
}: {
  groups: RequirementGroup[];
  options: RequirementOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [groupForm, setGroupForm] = useState<GroupForm | null>(null);
  const [optionForm, setOptionForm] = useState<OptionForm | null>(null);

  function refresh() {
    router.refresh();
  }

  function saveGroup() {
    if (!groupForm) return;
    start(async () => {
      const res = await saveRequirementGroup({
        id: groupForm.id,
        label: groupForm.label,
        icon: groupForm.icon || "list-checks",
        selectMode: groupForm.selectMode,
        sortOrder: Number(groupForm.sortOrder) || 100,
        isPublished: groupForm.isPublished,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(groupForm.id ? "Group saved" : "Group added");
      setGroupForm(null);
      refresh();
    });
  }

  function saveOption() {
    if (!optionForm) return;
    start(async () => {
      const res = await saveRequirementOption({
        id: optionForm.id,
        groupId: optionForm.groupId,
        label: optionForm.label,
        icon: optionForm.icon || "check",
        sortOrder: Number(optionForm.sortOrder) || 100,
        isPublished: optionForm.isPublished,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(optionForm.id ? "Option saved" : "Option added");
      setOptionForm(null);
      refresh();
    });
  }

  function removeGroup(g: RequirementGroup) {
    const reason = window.prompt(
      `Delete the "${g.label}" group and all its options? Enter a reason (min 5 chars):`,
    );
    if (!reason) return;
    start(async () => {
      const res = await deleteRequirementGroup({ id: g.id, reason });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Group deleted");
      refresh();
    });
  }

  function removeOption(o: RequirementOption) {
    const reason = window.prompt(
      `Delete "${o.label}"? Enter a reason (min 5 chars):`,
    );
    if (!reason) return;
    start(async () => {
      const res = await deleteRequirementOption({ id: o.id, reason });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Option deleted");
      refresh();
    });
  }

  const sortedGroups = [...groups].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setGroupForm({
              label: "",
              icon: "list-checks",
              selectMode: "multi",
              sortOrder: String((sortedGroups.at(-1)?.sort_order ?? 0) + 10),
              isPublished: true,
            })
          }
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add group
        </Button>
      </div>

      {sortedGroups.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center text-sm text-brand-mute">
          No requirement groups yet. Add one to get started.
        </div>
      ) : (
        sortedGroups.map((g) => {
          const groupOptions = options
            .filter((o) => o.group_id === g.id)
            .sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div
              key={g.id}
              className="rounded-card border border-brand-line bg-white shadow-card"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-brand-line px-5 py-3">
                <h2 className="font-display font-semibold text-brand-ink">
                  {g.label}
                </h2>
                <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[11px] font-medium text-brand-secondary">
                  {g.select_mode === "single" ? "Choose one" : "Choose many"}
                </span>
                <span className="text-[11px] text-brand-mute">
                  #{g.sort_order}
                </span>
                {!g.is_published && (
                  <span className="rounded-pill bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Hidden
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      setGroupForm({
                        id: g.id,
                        label: g.label,
                        icon: g.icon,
                        selectMode: g.select_mode,
                        sortOrder: String(g.sort_order),
                        isPublished: g.is_published,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-red-600 hover:text-red-700"
                    onClick={() => removeGroup(g)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 p-4">
                {groupOptions.map((o) => (
                  <div
                    key={o.id}
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] ${
                      o.is_published
                        ? "border-brand-line bg-white text-brand-ink"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    <span>{o.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOptionForm({
                          id: o.id,
                          groupId: g.id,
                          label: o.label,
                          icon: o.icon,
                          sortOrder: String(o.sort_order),
                          isPublished: o.is_published,
                        })
                      }
                      className="text-brand-mute hover:text-brand-ink"
                      aria-label={`Edit ${o.label}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOption(o)}
                      className="text-brand-mute hover:text-red-600"
                      aria-label={`Delete ${o.label}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    setOptionForm({
                      groupId: g.id,
                      label: "",
                      icon: "check",
                      sortOrder: String(
                        (groupOptions.at(-1)?.sort_order ?? g.sort_order * 10) +
                          10,
                      ),
                      isPublished: true,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add option
                </Button>
              </div>
            </div>
          );
        })
      )}

      {/* Group dialog */}
      <Dialog
        open={groupForm !== null}
        onOpenChange={(o) => !o && setGroupForm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {groupForm?.id ? "Edit group" : "Add group"}
            </DialogTitle>
          </DialogHeader>
          {groupForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={groupForm.label}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, label: e.target.value })
                  }
                  placeholder="e.g. Property type"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Selection</Label>
                  <Select
                    value={groupForm.selectMode}
                    onValueChange={(v) =>
                      setGroupForm({
                        ...groupForm,
                        selectMode: v as "single" | "multi",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Choose one</SelectItem>
                      <SelectItem value="multi">Choose many</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={groupForm.sortOrder}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, sortOrder: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Icon (lucide key)</Label>
                <Input
                  value={groupForm.icon}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, icon: e.target.value })
                  }
                  placeholder="list-checks"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-brand-ink">
                <Checkbox
                  checked={groupForm.isPublished}
                  onCheckedChange={(c) =>
                    setGroupForm({ ...groupForm, isPublished: !!c })
                  }
                />
                Published (visible to guests)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupForm(null)}>
              Cancel
            </Button>
            <Button onClick={saveGroup} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Option dialog */}
      <Dialog
        open={optionForm !== null}
        onOpenChange={(o) => !o && setOptionForm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {optionForm?.id ? "Edit option" : "Add option"}
            </DialogTitle>
          </DialogHeader>
          {optionForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={optionForm.label}
                  onChange={(e) =>
                    setOptionForm({ ...optionForm, label: e.target.value })
                  }
                  placeholder="e.g. Swimming pool"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Icon (lucide key)</Label>
                  <Input
                    value={optionForm.icon}
                    onChange={(e) =>
                      setOptionForm({ ...optionForm, icon: e.target.value })
                    }
                    placeholder="check"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={optionForm.sortOrder}
                    onChange={(e) =>
                      setOptionForm({
                        ...optionForm,
                        sortOrder: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-brand-ink">
                <Checkbox
                  checked={optionForm.isPublished}
                  onCheckedChange={(c) =>
                    setOptionForm({ ...optionForm, isPublished: !!c })
                  }
                />
                Published (visible to guests)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptionForm(null)}>
              Cancel
            </Button>
            <Button onClick={saveOption} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
