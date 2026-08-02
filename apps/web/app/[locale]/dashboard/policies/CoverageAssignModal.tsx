"use client";

import { Building2, Check, DoorClosed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import { setListingPolicyAction } from "./actions";
import { POLICY_TYPE_LABEL, type PolicyType } from "./schemas";

export type CoverageItem = {
  key: string;
  scope: "room" | "listing";
  listingId: string;
  listingName: string;
  /** null for a whole-listing (property) gap. */
  roomId: string | null;
  /** Room name, or listing name for a property gap. */
  targetName: string;
  missing: PolicyType[];
};

/**
 * Inline "fix the gap" modal opened from the coverage warning. Assigns a policy
 * for each missing type directly to the target (a room, or the whole listing) —
 * no redirect to the room editor. For a room gap, a toggle lets the host cover
 * every room at once by assigning it listing-wide instead. Same write as
 * everywhere else (setListingPolicyAction).
 */
export function CoverageAssignModal({
  open,
  onOpenChange,
  item,
  optionsByType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CoverageItem | null;
  optionsByType: Record<string, { id: string; name: string }[]>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyType, setBusyType] = useState<PolicyType | null>(null);
  // Per-type value chosen/assigned in this session.
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  // Room gaps only: apply to the whole listing (every room) instead of this room.
  const [applyWhole, setApplyWhole] = useState(false);

  if (!item) return null;
  const isRoom = item.scope === "room";
  const roomTarget = isRoom && !applyWhole ? item.roomId : null;

  function assign(type: PolicyType, policyId: string) {
    if (!item) return;
    if (!policyId) return;
    setBusyType(type);
    start(async () => {
      const res = await setListingPolicyAction(
        item.listingId,
        type,
        roomTarget,
        policyId,
      );
      setBusyType(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAssigned((prev) => ({ ...prev, [type]: policyId }));
      toast.success("Policy assigned");
      router.refresh();
    });
  }

  const allDone = item.missing.every((t) => assigned[t]);

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        isRoom
          ? `Assign policies — ${item.targetName}`
          : `Whole-listing policies — ${item.listingName}`
      }
      description={
        isRoom
          ? `${item.listingName} · this room is missing ${item.missing.length} ${item.missing.length === 1 ? "policy" : "policies"}. Pick one for each — or apply to every room at once.`
          : `This listing has room-level policies but no whole-listing policy — set one so booking the whole place is covered.`
      }
      size="md"
    >
      <div className="space-y-3">
        {isRoom ? (
          <label className="flex items-center gap-2.5 rounded-[10px] border border-brand-line bg-brand-light/40 px-3 py-2.5">
            <input
              type="checkbox"
              checked={applyWhole}
              onChange={(e) => setApplyWhole(e.target.checked)}
              className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
            />
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-ink">
              <Building2 className="h-3.5 w-3.5 text-brand-primary" />
              Apply to the whole listing (covers every room)
            </span>
          </label>
        ) : null}

        {item.missing.map((type) => {
          const options = optionsByType[type] ?? [];
          const done = Boolean(assigned[type]);
          return (
            <div
              key={type}
              className="rounded-[10px] border border-brand-line bg-white px-3 py-2.5"
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-ink">
                {done ? (
                  <Check className="h-3.5 w-3.5 text-status-confirmed" />
                ) : (
                  <DoorClosed className="h-3.5 w-3.5 text-status-pending" />
                )}
                {POLICY_TYPE_LABEL[type]}
              </div>
              {options.length === 0 ? (
                <p className="text-[11.5px] italic text-brand-mute">
                  No {POLICY_TYPE_LABEL[type].toLowerCase()} exists yet — create
                  one on the Policies page first.
                </p>
              ) : (
                <select
                  value={assigned[type] ?? ""}
                  onChange={(e) => assign(type, e.target.value)}
                  disabled={pending && busyType === type}
                  className="h-9 w-full rounded border border-brand-line bg-white px-2 text-sm text-brand-ink disabled:opacity-60"
                >
                  <option value="">
                    {pending && busyType === type
                      ? "Assigning…"
                      : "Choose a policy…"}
                  </option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <FormModalFooter>
        <FormModalCancel>{allDone ? "Done" : "Close"}</FormModalCancel>
      </FormModalFooter>
    </FormModal>
  );
}
