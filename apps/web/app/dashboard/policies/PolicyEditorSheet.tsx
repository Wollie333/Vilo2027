"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { createPolicyAction, updatePolicyAction } from "./actions";
import type { PolicyCard } from "./PolicyManager";
import {
  POLICY_TYPE_LABEL,
  type PolicyInput,
  type PolicyType,
} from "./schemas";

type RuleRow = { days_before: string; refund_percent: string; label: string };

const HOUSE_RULES_STARTER =
  "<h2>House rules</h2><ul><li>No smoking indoors.</li><li>No parties or events.</li><li>Quiet hours after 22:00.</li><li>Please treat the property with respect.</li></ul>";

export function PolicyEditorSheet({
  open,
  onOpenChange,
  type,
  policy,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PolicyType;
  policy: PolicyCard | null;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [checkIn, setCheckIn] = useState("14:00");
  const [checkOut, setCheckOut] = useState("10:00");
  const [bodyHtml, setBodyHtml] = useState("");

  // Reset the form whenever the sheet opens for a new target.
  useEffect(() => {
    if (!open) return;
    setName(policy?.name ?? "");
    setSummary(policy?.summary ?? "");
    setIsNonRefundable(policy?.isNonRefundable ?? false);
    setRules(
      (policy?.rules ?? []).map((r) => ({
        days_before: String(r.days_before),
        refund_percent: String(r.refund_percent),
        label: r.label,
      })),
    );
    setCheckIn(policy?.checkInTime?.slice(0, 5) ?? "14:00");
    setCheckOut(policy?.checkOutTime?.slice(0, 5) ?? "10:00");
    setBodyHtml(policy?.bodyHtml ?? "");
  }, [open, policy]);

  const isEdit = !!policy;
  const typeLabel = POLICY_TYPE_LABEL[type];

  function addRule() {
    setRules([...rules, { days_before: "", refund_percent: "", label: "" }]);
  }

  function buildInput(): PolicyInput | { error: string } {
    const trimmedName = name.trim();
    if (!trimmedName) return { error: "Add a name." };
    const summaryVal = summary.trim() || null;

    if (type === "cancellation") {
      const parsedRules = rules.map((r) => ({
        days_before: parseInt(r.days_before, 10),
        refund_percent: parseInt(r.refund_percent, 10),
        label: r.label.trim(),
      }));
      for (const r of parsedRules) {
        if (
          !Number.isFinite(r.days_before) ||
          !Number.isFinite(r.refund_percent) ||
          !r.label
        ) {
          return { error: "Every rule needs days, a percent and a label." };
        }
      }
      return {
        type: "cancellation",
        data: {
          name: trimmedName,
          summary: summaryVal,
          is_non_refundable: isNonRefundable,
          rules: isNonRefundable ? [] : parsedRules,
          body_html: bodyHtml || null,
        },
      };
    }

    if (type === "check_in_out") {
      return {
        type: "check_in_out",
        data: {
          name: trimmedName,
          summary: summaryVal,
          check_in_time: checkIn,
          check_out_time: checkOut,
          body_html: bodyHtml || null,
        },
      };
    }

    return {
      type: "house_rules",
      data: { name: trimmedName, summary: summaryVal, body_html: bodyHtml },
    };
  }

  function submit() {
    const built = buildInput();
    if ("error" in built) {
      toast.error(built.error);
      return;
    }
    start(async () => {
      const result = policy
        ? await updatePolicyAction(policy.id, built)
        : await createPolicyAction(built);
      if (result.ok) {
        toast.success(isEdit ? "Policy saved" : "Policy created");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-brand-ink">
            {isEdit ? "Edit" : "New"} {typeLabel.toLowerCase()}
          </SheetTitle>
          <SheetDescription>
            {type === "cancellation"
              ? "Set how much guests get back when they cancel."
              : type === "check_in_out"
                ? "Set the check-in and check-out times for this policy."
                : "Write the house rules guests agree to when booking."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              placeholder={
                type === "cancellation"
                  ? "e.g. Standard refund terms"
                  : type === "check_in_out"
                    ? "e.g. Standard check-in"
                    : "e.g. House rules"
              }
            />
          </Field>

          <Field label="Summary (shown on cards & checkout)">
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={pending}
              placeholder="One short line guests see before opening the full policy."
            />
          </Field>

          {type === "cancellation" ? (
            <>
              <label className="flex items-center gap-2 text-sm text-brand-dark">
                <input
                  type="checkbox"
                  checked={isNonRefundable}
                  onChange={(e) => setIsNonRefundable(e.target.checked)}
                  disabled={pending}
                  className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                />
                Non-refundable (no refund at any time)
              </label>

              {!isNonRefundable ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    Refund rules
                  </div>
                  <p className="text-xs text-brand-mute">
                    The rule with the largest matching “days before check-in”
                    wins. Add a 0-day rule for after check-in.
                  </p>
                  {rules.map((r, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <Field label="Days before" className="w-24">
                        <Input
                          type="number"
                          min={0}
                          value={r.days_before}
                          onChange={(e) =>
                            setRules(
                              rules.map((x, j) =>
                                j === i
                                  ? { ...x, days_before: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          disabled={pending}
                        />
                      </Field>
                      <Field label="Refund %" className="w-24">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={r.refund_percent}
                          onChange={(e) =>
                            setRules(
                              rules.map((x, j) =>
                                j === i
                                  ? { ...x, refund_percent: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          disabled={pending}
                        />
                      </Field>
                      <Field label="Label" className="flex-1">
                        <Input
                          value={r.label}
                          onChange={(e) =>
                            setRules(
                              rules.map((x, j) =>
                                j === i ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                          disabled={pending}
                          placeholder="e.g. Full refund"
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() =>
                          setRules(rules.filter((_, j) => j !== i))
                        }
                        disabled={pending}
                        aria-label="Remove rule"
                        className="mb-1.5 flex h-9 w-9 items-center justify-center rounded text-brand-mute hover:bg-red-50 hover:text-status-cancelled"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRule}
                    disabled={pending}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Add rule
                  </Button>
                </div>
              ) : null}

              <Field label="Full policy text (optional)">
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  disabled={pending}
                  placeholder="Explain your refund terms in full — guests can read this at checkout."
                />
              </Field>
            </>
          ) : null}

          {type === "check_in_out" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check-in time">
                  <Input
                    type="time"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Check-out time">
                  <Input
                    type="time"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    disabled={pending}
                  />
                </Field>
              </div>
              <Field label="Arrival notes (optional)">
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  disabled={pending}
                  placeholder="Key collection, parking, late arrival — anything guests should know."
                />
              </Field>
            </>
          ) : null}

          {type === "house_rules" ? (
            <Field label="House rules">
              <div className="space-y-2">
                {!bodyHtml ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBodyHtml(HOUSE_RULES_STARTER)}
                    disabled={pending}
                  >
                    Insert starter rules
                  </Button>
                ) : null}
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  disabled={pending}
                  placeholder="Quiet hours, smoking, pets, parties…"
                />
              </div>
            </Field>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={pending}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create policy"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
