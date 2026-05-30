"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { setListingPolicyAction } from "../../../../policies/actions";
import {
  POLICY_TYPE_LABEL,
  type PolicyType,
} from "../../../../policies/schemas";
import type { EditorRoom } from "../Editor";

export type AvailablePolicy = { id: string; name: string; type: PolicyType };
export type AssignedPolicy = {
  policyId: string;
  policyType: PolicyType;
  roomId: string | null;
};

const SECTION_BLURB: Partial<Record<PolicyType, string>> = {
  cancellation: "How much guests are refunded if they cancel.",
  check_in_out: "Check-in and check-out times for this listing.",
  house_rules: "The rules guests agree to when booking.",
};

export function PoliciesTab({
  listingId,
  listingType,
  rooms,
  available,
  assigned: initialAssigned,
}: {
  listingId: string;
  listingType: "accommodation" | "experience";
  rooms: EditorRoom[];
  available: AvailablePolicy[];
  assigned: AssignedPolicy[];
}) {
  const [assigned, setAssigned] = useState<AssignedPolicy[]>(initialAssigned);

  // Experiences have no check-in/out; everything else applies.
  const types: PolicyType[] =
    listingType === "experience"
      ? ["cancellation", "house_rules"]
      : ["cancellation", "check_in_out", "house_rules"];

  const byType = useMemo(() => {
    const m = new Map<PolicyType, AvailablePolicy[]>();
    for (const p of available) {
      const arr = m.get(p.type) ?? [];
      arr.push(p);
      m.set(p.type, arr);
    }
    return m;
  }, [available]);

  function currentPolicyId(type: PolicyType, roomId: string | null): string {
    const row = assigned.find(
      (a) => a.policyType === type && a.roomId === roomId,
    );
    return row?.policyId ?? "";
  }

  async function assign(
    type: PolicyType,
    roomId: string | null,
    policyId: string,
  ) {
    const prev = assigned;
    const next = assigned.filter(
      (a) => !(a.policyType === type && a.roomId === roomId),
    );
    if (policyId) next.push({ policyType: type, roomId, policyId });
    setAssigned(next);

    const result = await setListingPolicyAction(
      listingId,
      type,
      roomId,
      policyId || null,
    );
    if (!result.ok) {
      setAssigned(prev);
      toast.error(result.error);
    }
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Policies
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Assign refund terms, check-in/out times and house rules to this
          listing. Create and edit them under{" "}
          <Link
            href="/dashboard/policies"
            className="text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:decoration-brand-primary"
          >
            Tools → Policies
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {types.map((type) => {
          const options = byType.get(type) ?? [];
          return (
            <div key={type} className="space-y-3">
              <div>
                <div className="font-display text-sm font-semibold text-brand-dark">
                  {POLICY_TYPE_LABEL[type]}
                </div>
                <p className="text-xs text-brand-mute">{SECTION_BLURB[type]}</p>
              </div>

              {options.length === 0 ? (
                <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-3 py-3 text-xs text-brand-mute">
                  No {POLICY_TYPE_LABEL[type].toLowerCase()} yet.{" "}
                  <Link
                    href="/dashboard/policies"
                    className="text-brand-primary underline underline-offset-2"
                  >
                    Create one
                  </Link>
                  .
                </div>
              ) : (
                <>
                  <PolicySelect
                    label="Listing-wide"
                    value={currentPolicyId(type, null)}
                    options={options}
                    onChange={(id) => assign(type, null, id)}
                    placeholder="None"
                  />

                  {listingType === "accommodation" && rooms.length > 0 ? (
                    <details className="rounded border border-brand-line bg-brand-light/30 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-brand-mute">
                        Room overrides ({rooms.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {rooms.map((room) => (
                          <PolicySelect
                            key={room.id}
                            label={room.name}
                            value={currentPolicyId(type, room.id)}
                            options={options}
                            onChange={(id) => assign(type, room.id, id)}
                            placeholder="Use listing default"
                          />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PolicySelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: AvailablePolicy[];
  onChange: (id: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate text-sm text-brand-ink">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-56 max-w-[60%] rounded border border-brand-line bg-white px-2 text-sm text-brand-ink"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
