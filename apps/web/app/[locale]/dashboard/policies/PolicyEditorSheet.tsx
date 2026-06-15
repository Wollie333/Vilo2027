"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/button";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Field, TextInput } from "@/app/[locale]/dashboard/setup/_atoms";

import { createPolicyAction, updatePolicyAction } from "./actions";
import type { PolicyCard } from "./policy-card";
import {
  CHECK_IN_METHODS,
  CHECK_IN_METHOD_LABEL,
  POLICY_TYPE_LABEL,
  type CheckInMethod,
  type PolicyInput,
  type PolicyType,
} from "./schemas";

type RuleRow = { days_before: string; refund_percent: string; label: string };

// Tri-state house-rule flag: "" = unspecified, "yes"/"no" = allowed/not.
type TriState = "" | "yes" | "no";
const triToBool = (v: TriState): boolean | null =>
  v === "" ? null : v === "yes";
const boolToTri = (v: boolean | null | undefined): TriState =>
  v === null || v === undefined ? "" : v ? "yes" : "no";

const HOUSE_RULES_STARTER =
  "<h2>House rules</h2><ul><li>No smoking indoors.</li><li>No parties or events.</li><li>Quiet hours after 22:00.</li><li>Please treat the property with respect.</li></ul>";

// A sensible, balanced refund schedule hosts can drop in and tweak.
const CANCELLATION_STARTER: RuleRow[] = [
  { days_before: "14", refund_percent: "100", label: "Full refund" },
  { days_before: "7", refund_percent: "50", label: "Half refund" },
  { days_before: "0", refund_percent: "0", label: "No refund" },
];

const CHECK_IN_STARTER =
  "<p>Check-in is from 15:00; check-out by 10:00. We'll send access details the day before arrival. Arriving late? Message us so we can arrange access. Free on-site parking is available.</p>";

export function PolicyEditorSheet({
  open,
  onOpenChange,
  type,
  policy,
  onSaved,
  createAction = createPolicyAction,
  updateAction = updatePolicyAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PolicyType;
  policy: PolicyCard | null;
  // On create, receives the new policy's id so callers can act on it (e.g. the
  // setup picker auto-assigns it to the listing). On edit, called with no arg.
  onSaved: (created?: { id: string }) => void;
  // Override the persistence actions — the admin listing editor injects
  // listing-context variants so staff can manage a user's policies.
  createAction?: typeof createPolicyAction;
  updateAction?: (
    policyId: string,
    input: Parameters<typeof createPolicyAction>[0],
  ) => ReturnType<typeof updatePolicyAction>;
}) {
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [checkIn, setCheckIn] = useState("14:00");
  const [checkOut, setCheckOut] = useState("10:00");
  const [checkInMethod, setCheckInMethod] = useState<CheckInMethod | "">("");
  const [pets, setPets] = useState<TriState>("");
  const [smoking, setSmoking] = useState<TriState>("");
  const [parties, setParties] = useState<TriState>("");
  const [children, setChildren] = useState<TriState>("");
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
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
    setCheckInMethod(policy?.checkInMethod ?? "");
    setPets(boolToTri(policy?.petsAllowed));
    setSmoking(boolToTri(policy?.smokingAllowed));
    setParties(boolToTri(policy?.partiesAllowed));
    setChildren(boolToTri(policy?.childrenWelcome));
    setQuietStart(policy?.quietHoursStart?.slice(0, 5) ?? "");
    setQuietEnd(policy?.quietHoursEnd?.slice(0, 5) ?? "");
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
          check_in_method: checkInMethod || null,
          body_html: bodyHtml || null,
        },
      };
    }

    if (type === "house_rules") {
      return {
        type: "house_rules",
        data: {
          name: trimmedName,
          summary: summaryVal,
          pets_allowed: triToBool(pets),
          smoking_allowed: triToBool(smoking),
          parties_allowed: triToBool(parties),
          children_welcome: triToBool(children),
          quiet_hours_start: quietStart || null,
          quiet_hours_end: quietEnd || null,
          body_html: bodyHtml,
        },
      };
    }

    // booking_terms | privacy — legal documents (prose only).
    return {
      type,
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
        ? await updateAction(policy.id, built)
        : await createAction(built);
      if (result.ok) {
        toast.success(isEdit ? "Policy saved" : "Policy created");
        onOpenChange(false);
        onSaved(!isEdit && result.data ? { id: result.data.id } : undefined);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${isEdit ? "Edit" : "New"} ${typeLabel.toLowerCase()}`}
      description={
        type === "cancellation"
          ? "Set how much guests get back when they cancel."
          : type === "check_in_out"
            ? "Set the check-in and check-out times for this policy."
            : type === "house_rules"
              ? "Write the house rules guests agree to when booking."
              : type === "booking_terms"
                ? "The agreement guests accept at checkout."
                : "How guest data is collected, stored and used."
      }
      size="lg"
    >
      <div className="space-y-5">
        <Field label="Name" required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            placeholder={
              type === "cancellation"
                ? "e.g. Standard refund terms"
                : type === "check_in_out"
                  ? "e.g. Standard check-in"
                  : type === "house_rules"
                    ? "e.g. House rules"
                    : type === "booking_terms"
                      ? "e.g. Booking terms & conditions"
                      : "e.g. Guest privacy (POPIA)"
            }
          />
        </Field>

        <Field
          label="Summary"
          hint="One short line guests see on cards & checkout."
        >
          <TextInput
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={pending}
            placeholder="Shown before guests open the full policy."
          />
        </Field>

        {type === "cancellation" ? (
          <>
            <label className="flex items-center gap-2 text-sm text-brand-ink">
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
              <div className="space-y-2.5">
                <div className="text-sm font-medium text-brand-ink">
                  Refund rules
                  <span className="ml-0.5 text-status-cancelled" aria-hidden>
                    *
                  </span>
                </div>
                <p className="text-xs text-brand-mute">
                  The rule with the largest matching “days before check-in”
                  wins. Add a 0-day rule for after check-in.
                </p>
                {rules.map((r, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="w-24">
                      <Field label="Days before">
                        <TextInput
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
                    </div>
                    <div className="w-24">
                      <Field label="Refund %">
                        <TextInput
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
                    </div>
                    <div className="flex-1">
                      <Field label="Label">
                        <TextInput
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
                    </div>
                    <button
                      type="button"
                      onClick={() => setRules(rules.filter((_, j) => j !== i))}
                      disabled={pending}
                      aria-label="Remove rule"
                      className="mb-1 flex h-10 w-10 items-center justify-center rounded text-brand-mute hover:bg-red-50 hover:text-status-cancelled"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
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
                  {rules.length === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRules(CANCELLATION_STARTER)}
                      disabled={pending}
                    >
                      Insert starter rules
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Field label="Full policy text" optional>
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
              <Field label="Check-in time" required>
                <TextInput
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field label="Check-out time" required>
                <TextInput
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  disabled={pending}
                />
              </Field>
            </div>
            <Field
              label="Check-in method"
              hint="Shown as a pill on the policy card."
            >
              <select
                value={checkInMethod}
                onChange={(e) =>
                  setCheckInMethod(e.target.value as CheckInMethod | "")
                }
                disabled={pending}
                className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary disabled:opacity-60"
              >
                <option value="">Not specified</option>
                {CHECK_IN_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {CHECK_IN_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Arrival notes" optional>
              <div className="space-y-2">
                {!bodyHtml ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBodyHtml(CHECK_IN_STARTER)}
                    disabled={pending}
                  >
                    Insert starter notes
                  </Button>
                ) : null}
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  disabled={pending}
                  placeholder="Key collection, parking, late arrival — anything guests should know."
                />
              </div>
            </Field>
          </>
        ) : null}

        {type === "house_rules" ? (
          <>
            <div className="space-y-2.5">
              <div className="text-sm font-medium text-brand-ink">
                Quick rules
              </div>
              <p className="text-xs text-brand-mute">
                These show as chips on the policy card. Leave any “Not set” to
                hide it.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FlagSelect
                  label="Pets"
                  value={pets}
                  onChange={setPets}
                  yes="Pets OK"
                  no="No pets"
                  disabled={pending}
                />
                <FlagSelect
                  label="Smoking"
                  value={smoking}
                  onChange={setSmoking}
                  yes="Smoking OK"
                  no="No smoking"
                  disabled={pending}
                />
                <FlagSelect
                  label="Parties"
                  value={parties}
                  onChange={setParties}
                  yes="Parties OK"
                  no="No parties"
                  disabled={pending}
                />
                <FlagSelect
                  label="Children"
                  value={children}
                  onChange={setChildren}
                  yes="Children welcome"
                  no="No children"
                  disabled={pending}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quiet hours from" optional>
                  <TextInput
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Quiet hours until" optional>
                  <TextInput
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    disabled={pending}
                  />
                </Field>
              </div>
            </div>

            <Field label="House rules" required>
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
          </>
        ) : null}

        {type === "booking_terms" || type === "privacy" ? (
          <Field label="Document text" required>
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              disabled={pending}
              placeholder={
                type === "booking_terms"
                  ? "Deposit, damages, liability — the terms guests accept at checkout."
                  : "What you collect, how it's used, and guests' POPIA rights."
              }
            />
          </Field>
        ) : null}
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <Button
          type="button"
          onClick={submit}
          disabled={pending}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create policy"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

function FlagSelect({
  label,
  value,
  onChange,
  yes,
  no,
  disabled,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
  yes: string;
  no: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TriState)}
        disabled={disabled}
        className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary disabled:opacity-60"
      >
        <option value="">Not set</option>
        <option value="yes">{yes}</option>
        <option value="no">{no}</option>
      </select>
    </Field>
  );
}
