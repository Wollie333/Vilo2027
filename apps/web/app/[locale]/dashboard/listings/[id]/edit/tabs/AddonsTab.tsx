"use client";

import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { setListingAddonAction } from "../../../../addons/actions";
import { PRICING_LABEL, type PricingModel } from "../../../../addons/schemas";
import type { EditorRoom } from "../Editor";

export type AvailableAddon = {
  id: string;
  name: string;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  isActive: boolean;
};

export type AssignedAddon = {
  addonId: string;
  roomId: string | null;
  unitPriceOverride: number | null;
};

function toNum(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function AddonsTab({
  listingId,
  available,
  rooms,
  initialAssigned,
}: {
  listingId: string;
  available: AvailableAddon[];
  rooms: EditorRoom[];
  initialAssigned: AssignedAddon[];
}) {
  const [assigned, setAssigned] = useState<AssignedAddon[]>(initialAssigned);

  const byAddonId = useMemo(() => {
    const m = new Map<string, AssignedAddon>();
    for (const a of assigned) m.set(a.addonId, a);
    return m;
  }, [assigned]);

  async function setRow(addonId: string, next: AssignedAddon | null) {
    const prev = byAddonId.get(addonId) ?? null;
    // Optimistic
    if (next === null) {
      setAssigned((s) => s.filter((a) => a.addonId !== addonId));
    } else {
      setAssigned((s) => {
        const others = s.filter((a) => a.addonId !== addonId);
        return [...others, next];
      });
    }
    const result = await setListingAddonAction(
      listingId,
      addonId,
      next === null
        ? null
        : { room_id: next.roomId, unit_price_override: next.unitPriceOverride },
    );
    if (!result.ok) {
      // Rollback
      setAssigned((s) => {
        const others = s.filter((a) => a.addonId !== addonId);
        return prev ? [...others, prev] : others;
      });
      toast.error(result.error);
    }
  }

  function toggle(addonId: string) {
    const existing = byAddonId.get(addonId);
    if (existing) {
      setRow(addonId, null);
    } else {
      setRow(addonId, {
        addonId,
        roomId: null,
        unitPriceOverride: null,
      });
    }
  }

  function changeRoom(addonId: string, roomId: string | null) {
    const existing = byAddonId.get(addonId);
    if (!existing) return;
    setRow(addonId, { ...existing, roomId });
  }

  function changeOverride(addonId: string, value: string) {
    const existing = byAddonId.get(addonId);
    if (!existing) return;
    setRow(addonId, { ...existing, unitPriceOverride: toNum(value) });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Add-ons
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Pick which extras guests can buy with a booking on this listing.
          Manage the catalog itself under{" "}
          <Link
            href="/dashboard/addons"
            className="text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:decoration-brand-primary"
          >
            Tools → Add-ons
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        {available.length === 0 ? (
          <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center text-sm text-brand-mute">
            No active add-ons yet.{" "}
            <Link
              href="/dashboard/addons"
              className="text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:decoration-brand-primary"
            >
              Create your first one
            </Link>{" "}
            to start offering extras.
          </div>
        ) : (
          <div className="space-y-2">
            {available.map((addon) => {
              const row = byAddonId.get(addon.id);
              const checked = !!row;
              return (
                <div
                  key={addon.id}
                  className={`rounded border px-3 py-2.5 text-sm transition-colors ${
                    checked
                      ? "border-brand-primary bg-brand-accent/40"
                      : "border-brand-line bg-white hover:bg-brand-light/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(addon.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-brand-ink">
                          {addon.name}
                        </div>
                        <div className="text-xs text-brand-mute">
                          R{" "}
                          {Math.round(addon.unitPrice)
                            .toLocaleString("en-ZA")
                            .replace(/,/g, " ")}{" "}
                          {PRICING_LABEL[addon.pricingModel]}
                        </div>
                      </div>
                    </label>

                    {checked && rooms.length > 0 ? (
                      <select
                        value={row?.roomId ?? ""}
                        onChange={(e) =>
                          changeRoom(
                            addon.id,
                            e.target.value === "" ? null : e.target.value,
                          )
                        }
                        className="rounded border border-brand-line bg-white px-2 py-1 text-[11px] text-brand-mute"
                        aria-label="Assign add-on to room"
                      >
                        <option value="">Listing-wide</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  {checked ? (
                    <div className="mt-2 flex items-center gap-2 pl-7">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                        Price override
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        placeholder={`Default R ${addon.unitPrice}`}
                        defaultValue={
                          row?.unitPriceOverride == null
                            ? ""
                            : String(row.unitPriceOverride)
                        }
                        onBlur={(e) => changeOverride(addon.id, e.target.value)}
                        className="h-8 max-w-[160px] text-xs"
                      />
                      <span className="text-[11px] text-brand-mute">
                        Leave blank to use the catalog price.
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
