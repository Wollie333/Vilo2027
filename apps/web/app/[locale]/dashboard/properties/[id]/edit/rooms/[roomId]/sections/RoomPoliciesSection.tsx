"use client";

import {
  ArrowUpRight,
  Building2,
  RotateCcw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setListingPolicyAction } from "../../../../../../policies/actions";
import {
  POLICY_TYPE_LABEL,
  type PolicyType,
} from "../../../../../../policies/schemas";

export type RoomPolicyOption = { id: string; name: string };
export type RoomPolicyInfo = {
  type: PolicyType;
  options: RoomPolicyOption[];
  /** Explicit per-room assignment, or null when the room inherits. */
  roomOverrideId: string | null;
  /** The listing-wide assignment for this type, if any. */
  listingWide: RoomPolicyOption | null;
  /** The host's default for this type, the ultimate fallback. */
  hostDefault: RoomPolicyOption | null;
};

const SECTION_BLURB: Partial<Record<PolicyType, string>> = {
  cancellation: "How much guests are refunded if they cancel this room.",
  check_in_out: "Check-in and check-out times for this room.",
  house_rules: "The rules guests agree to when booking this room.",
  booking_terms: "The terms guests accept at checkout for this room.",
};

/**
 * Per-room policy assignment. Each room inherits its listing's whole-listing
 * policy (or the host default) unless it's overridden here — so a host sees
 * exactly which policy applies and where it comes from, and can override any
 * type for this room only. Writes go through the same setListingPolicyAction
 * the listing editor uses (listingId, type, roomId, policyId|null).
 */
export function RoomPoliciesSection({
  listingId,
  roomId,
  policies,
}: {
  listingId: string;
  roomId: string;
  policies: RoomPolicyInfo[];
}) {
  return (
    <div className="space-y-4">
      {policies.map((p) => (
        <PolicyTypeRow
          key={p.type}
          listingId={listingId}
          roomId={roomId}
          info={p}
        />
      ))}
      <div className="flex items-center gap-2 rounded-card border border-dashed border-brand-line bg-brand-light/40 px-4 py-3 text-[12px] text-brand-mute">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand-primary" />
        <span>
          Rooms inherit the whole-listing policy by default. Override here to
          set a different one for this room only.{" "}
          <Link
            href="/dashboard/policies"
            className="inline-flex items-center gap-0.5 font-medium text-brand-secondary hover:text-brand-primary"
          >
            Manage policies <ArrowUpRight className="h-3 w-3" />
          </Link>
        </span>
      </div>
    </div>
  );
}

function PolicyTypeRow({
  listingId,
  roomId,
  info,
}: {
  listingId: string;
  roomId: string;
  info: RoomPolicyInfo;
}) {
  const [overrideId, setOverrideId] = useState<string | null>(
    info.roomOverrideId,
  );
  const [pending, start] = useTransition();

  // The policy that actually applies + where it comes from.
  const overridden = overrideId != null;
  const inherited = info.listingWide ?? info.hostDefault;
  const effective = overridden
    ? (info.options.find((o) => o.id === overrideId) ?? null)
    : inherited;
  const source: "room" | "listing" | "default" | "none" = overridden
    ? "room"
    : info.listingWide
      ? "listing"
      : info.hostDefault
        ? "default"
        : "none";

  function change(next: string) {
    const nextId = next === "" ? null : next;
    const prev = overrideId;
    setOverrideId(nextId);
    start(async () => {
      const res = await setListingPolicyAction(
        listingId,
        info.type,
        roomId,
        nextId,
      );
      if (!res.ok) {
        setOverrideId(prev);
        toast.error(res.error);
        return;
      }
      toast.success(nextId ? "Room override saved" : "Reverted to inherited");
    });
  }

  const inheritLabel = inherited
    ? `Inherit — ${inherited.name}${info.listingWide ? " (whole listing)" : " (your default)"}`
    : "Inherit (no default set)";

  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold text-brand-ink">
            {POLICY_TYPE_LABEL[info.type]}
          </div>
          <p className="mt-0.5 text-xs text-brand-mute">
            {SECTION_BLURB[info.type]}
          </p>
        </div>
        <SourceBadge source={source} />
      </div>

      {/* What applies now */}
      <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-brand-line bg-brand-light/40 px-3 py-2">
        <Star className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-brand-ink">
          {effective ? (
            <>
              Applies now:{" "}
              <span className="font-semibold">{effective.name}</span>
            </>
          ) : (
            <span className="italic text-brand-mute">
              No policy resolves — set a default in Policies.
            </span>
          )}
        </span>
      </div>

      {/* Override control */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={overrideId ?? ""}
          onChange={(e) => change(e.target.value)}
          disabled={pending}
          className="h-9 min-w-0 flex-1 rounded border border-brand-line bg-white px-2 text-sm text-brand-ink disabled:opacity-60"
        >
          <option value="">{inheritLabel}</option>
          {info.options.map((o) => (
            <option key={o.id} value={o.id}>
              Override — {o.name}
            </option>
          ))}
        </select>
        {overridden ? (
          <button
            type="button"
            onClick={() => change("")}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Inherit
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SourceBadge({
  source,
}: {
  source: "room" | "listing" | "default" | "none";
}) {
  const map = {
    room: {
      cls: "border-brand-primary/30 bg-brand-accent text-brand-secondary",
      label: "Room override",
      icon: ShieldCheck,
    },
    listing: {
      cls: "border-brand-line bg-brand-light text-brand-mute",
      label: "From whole listing",
      icon: Building2,
    },
    default: {
      cls: "border-brand-line bg-brand-light text-brand-mute",
      label: "Your default",
      icon: Star,
    },
    none: {
      cls: "border-status-pending/30 bg-status-pending/10 text-status-pending",
      label: "Not set",
      icon: ShieldCheck,
    },
  } as const;
  const m = map[source];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.cls}`}
    >
      <Icon className="h-2.5 w-2.5" /> {m.label}
    </span>
  );
}
