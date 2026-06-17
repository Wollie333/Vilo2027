"use client";

import { Pencil, Plus } from "lucide-react";
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

import {
  createAddonForListingAction,
  setListingAddonAction,
  updateAddonForListingAction,
  type AddonFormInput,
} from "../../../../addons/actions";
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

const MODELS = Object.keys(PRICING_LABEL) as PricingModel[];

function AddonForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: AvailableAddon;
  onCancel: () => void;
  onSave: (input: AddonFormInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [model, setModel] = useState<PricingModel>(
    initial?.pricingModel ?? "per_stay",
  );
  const [price, setPrice] = useState(initial ? String(initial.unitPrice) : "");
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Add a name.");
      return;
    }
    setBusy(true);
    await onSave({
      name: name.trim(),
      pricing_model: model,
      unit_price: Number(price) || 0,
      is_active: active,
    });
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded border border-brand-primary/40 bg-brand-accent/30 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Name
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Airport transfer"
            className="h-9 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Pricing
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as PricingModel)}
            className="h-9 w-full rounded border border-brand-line bg-white px-2 text-sm text-brand-ink"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {PRICING_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Price (R)
          </span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="h-9 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm text-brand-ink">
          <Checkbox
            checked={active}
            onCheckedChange={(v) => setActive(v === true)}
          />
          Active (guests can buy)
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-pill bg-brand-primary px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save add-on"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-pill border border-brand-line bg-white px-4 py-1.5 text-[13px] font-medium text-brand-mute hover:bg-brand-light"
        >
          Cancel
        </button>
      </div>
    </div>
  );
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
  const [items, setItems] = useState<AvailableAddon[]>(available);
  const [assigned, setAssigned] = useState<AssignedAddon[]>(initialAssigned);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const byAddonId = useMemo(() => {
    const m = new Map<string, AssignedAddon>();
    for (const a of assigned) m.set(a.addonId, a);
    return m;
  }, [assigned]);

  async function setRow(addonId: string, next: AssignedAddon | null) {
    const prev = byAddonId.get(addonId) ?? null;
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
      setAssigned((s) => {
        const others = s.filter((a) => a.addonId !== addonId);
        return prev ? [...others, prev] : others;
      });
      toast.error(result.error);
    }
  }

  function toggle(addonId: string) {
    const existing = byAddonId.get(addonId);
    if (existing) setRow(addonId, null);
    else setRow(addonId, { addonId, roomId: null, unitPriceOverride: null });
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

  async function create(input: AddonFormInput) {
    const result = await createAddonForListingAction(listingId, input);
    if (!result.ok || !result.data) {
      toast.error(result.ok ? "Could not create add-on." : result.error);
      return;
    }
    setItems((s) => [...s, result.data!]);
    setCreating(false);
    toast.success("Add-on created.");
  }

  async function update(addonId: string, input: AddonFormInput) {
    const result = await updateAddonForListingAction(listingId, addonId, input);
    if (!result.ok || !result.data) {
      toast.error(result.ok ? "Could not save add-on." : result.error);
      return;
    }
    setItems((s) => s.map((a) => (a.id === addonId ? result.data! : a)));
    setEditingId(null);
    toast.success("Add-on saved.");
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Add-ons
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Create extras and pick which ones guests can buy with a booking on
            this listing.
          </CardDescription>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating((c) => !c);
            setEditingId(null);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-primary px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New add-on
        </button>
      </CardHeader>
      <CardContent className="space-y-2">
        {creating ? (
          <AddonForm onCancel={() => setCreating(false)} onSave={create} />
        ) : null}

        {items.length === 0 && !creating ? (
          <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center text-sm text-brand-mute">
            No add-ons yet. Use “New add-on” to create the first one.
          </div>
        ) : (
          items.map((addon) => {
            const row = byAddonId.get(addon.id);
            const checked = !!row;
            if (editingId === addon.id) {
              return (
                <AddonForm
                  key={addon.id}
                  initial={addon}
                  onCancel={() => setEditingId(null)}
                  onSave={(input) => update(addon.id, input)}
                />
              );
            }
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
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-brand-ink">
                          {addon.name}
                        </span>
                        {!addon.isActive ? (
                          <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-mute">
                            Hidden
                          </span>
                        ) : null}
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

                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(addon.id);
                      setCreating(false);
                    }}
                    aria-label="Edit add-on"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
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
          })
        )}
      </CardContent>
    </Card>
  );
}
