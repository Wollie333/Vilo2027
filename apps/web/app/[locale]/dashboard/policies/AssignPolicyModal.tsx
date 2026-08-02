"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import { setListingPolicyAction } from "./actions";
import { POLICY_TYPE_LABEL, type PolicyType } from "./schemas";

export type AssignRoom = { id: string; name: string };
export type AssignListing = { id: string; name: string; rooms: AssignRoom[] };
export type AssignmentRow = {
  property_id: string;
  room_id: string | null;
  policy_id: string;
  policy_type: string;
};

/**
 * Assign THIS policy to listings (and their rooms) straight from the policy
 * manager — the same write the listing editor's Policies tab does
 * (`setListingPolicyAction`), just reachable from the library. A scope already
 * holding another policy of this type is shown so the host sees what they're
 * replacing; assigning is one policy per (listing|room, type).
 */
export function AssignPolicyModal({
  open,
  onOpenChange,
  policyId,
  policyType,
  policyName,
  listings,
  assignments,
  policyNamesById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
  policyType: PolicyType;
  policyName: string;
  listings: AssignListing[];
  assignments: AssignmentRow[];
  policyNamesById: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Current assigned policy for each scope of THIS type: `${listing}:${room|_}`.
  const assignedByScope = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assignments) {
      if (a.policy_type !== policyType) continue;
      m.set(`${a.property_id}:${a.room_id ?? "_"}`, a.policy_id);
    }
    return m;
  }, [assignments, policyType]);

  // Optimistic overlay so toggles feel instant before the router refresh.
  const [overrides, setOverrides] = useState<Map<string, string | null>>(
    new Map(),
  );
  const scopeState = (listingId: string, roomId: string | null) => {
    const key = `${listingId}:${roomId ?? "_"}`;
    const current = overrides.has(key)
      ? overrides.get(key)!
      : (assignedByScope.get(key) ?? null);
    return { key, current };
  };

  function toggleScope(listingId: string, roomId: string | null) {
    const { key, current } = scopeState(listingId, roomId);
    const nextPolicy = current === policyId ? null : policyId; // off if already on
    setBusyKey(key);
    start(async () => {
      const res = await setListingPolicyAction(
        listingId,
        policyType,
        roomId,
        nextPolicy,
      );
      setBusyKey(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOverrides((prev) => new Map(prev).set(key, nextPolicy));
      toast.success(nextPolicy ? "Assigned" : "Removed");
      router.refresh();
    });
  }

  const typeLabel = POLICY_TYPE_LABEL[policyType] ?? "policy";

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Assign “${policyName}”`}
      description={
        listings.length === 0
          ? "Create a listing first, then assign this policy to it."
          : `Choose which listings (or individual rooms) use this ${typeLabel.toLowerCase()}. Each place uses one ${typeLabel.toLowerCase()} — assigning here replaces any other one of this type.`
      }
      size="lg"
    >
      {listings.length === 0 ? (
        <p className="py-8 text-center text-sm text-brand-mute">
          You have no listings yet.
        </p>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => {
            const wide = scopeState(l.id, null);
            return (
              <div
                key={l.id}
                className="overflow-hidden rounded-card border border-brand-line"
              >
                <ScopeRow
                  label={l.name}
                  bold
                  sublabel="Whole listing"
                  on={wide.current === policyId}
                  occupiedBy={
                    wide.current && wide.current !== policyId
                      ? (policyNamesById[wide.current] ?? "Another policy")
                      : null
                  }
                  busy={pending && busyKey === wide.key}
                  onToggle={() => toggleScope(l.id, null)}
                />
                {l.rooms.length > 0 ? (
                  <div className="divide-y divide-brand-line border-t border-brand-line bg-brand-light/30">
                    {l.rooms.map((r) => {
                      const rs = scopeState(l.id, r.id);
                      return (
                        <ScopeRow
                          key={r.id}
                          label={r.name}
                          sublabel="Room"
                          indent
                          on={rs.current === policyId}
                          occupiedBy={
                            rs.current && rs.current !== policyId
                              ? (policyNamesById[rs.current] ??
                                "Another policy")
                              : null
                          }
                          busy={pending && busyKey === rs.key}
                          onToggle={() => toggleScope(l.id, r.id)}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
          <p className="text-[11px] text-brand-mute">
            A room-level assignment overrides the whole-listing one. Listings
            with no assignment fall back to your default{" "}
            {typeLabel.toLowerCase()}.
          </p>
        </div>
      )}

      <FormModalFooter>
        <FormModalCancel>Done</FormModalCancel>
      </FormModalFooter>
    </FormModal>
  );
}

function ScopeRow({
  label,
  sublabel,
  on,
  occupiedBy,
  busy,
  bold,
  indent,
  onToggle,
}: {
  label: string;
  sublabel: string;
  on: boolean;
  occupiedBy: string | null;
  busy: boolean;
  bold?: boolean;
  indent?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2.5 ${
        indent ? "pl-7" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[13.5px] text-brand-ink ${
            bold ? "font-semibold" : "font-medium"
          }`}
        >
          {label}
        </div>
        <div className="truncate text-[11px] text-brand-mute">
          {occupiedBy ? `Currently: ${occupiedBy}` : sublabel}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={on}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
          on
            ? "border-brand-primary bg-brand-primary text-white hover:bg-brand-secondary"
            : "border-brand-line bg-white text-brand-ink hover:bg-brand-accent"
        }`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : on ? (
          <Check className="h-3.5 w-3.5" />
        ) : null}
        {on ? "Assigned" : "Assign"}
      </button>
    </div>
  );
}
