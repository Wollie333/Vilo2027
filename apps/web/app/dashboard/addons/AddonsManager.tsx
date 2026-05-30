"use client";

import { ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { modal } from "@/components/ui/modal-host";
import { Textarea } from "@/components/ui/textarea";

import { AddonImageInput } from "./AddonImageInput";
import {
  createAddonAction,
  deleteAddonAction,
  toggleAddonActiveAction,
  updateAddonAction,
} from "./actions";
import { PRICING_LABEL, PRICING_MODELS, type PricingModel } from "./schemas";

export type AddonCard = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  minQuantity: number;
  maxQuantity: number | null;
  isRequired: boolean;
  isActive: boolean;
  leadTimeDays: number;
};

function toInt(v: string): number | null {
  if (v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toNum(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numToStr(n: number | null | undefined, fallback = ""): string {
  return n == null ? fallback : String(n);
}

export function AddonsManager({ initial }: { initial: AddonCard[] }) {
  const [addons, setAddons] = useState<AddonCard[]>(initial);
  const [createPending, startCreate] = useTransition();

  function addAddon() {
    startCreate(async () => {
      const defaultName = `New add-on ${addons.length + 1}`;
      const result = await createAddonAction({
        name: defaultName,
        description: null,
        pricing_model: "per_stay",
        unit_price: 0,
        currency: "ZAR",
        min_quantity: 1,
        max_quantity: null,
        is_required: false,
        is_active: true,
        lead_time_days: 0,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAddons([
        ...addons,
        {
          id: result.data!.id,
          name: defaultName,
          description: null,
          imageUrl: null,
          pricingModel: "per_stay",
          unitPrice: 0,
          currency: "ZAR",
          minQuantity: 1,
          maxQuantity: null,
          isRequired: false,
          isActive: true,
          leadTimeDays: 0,
        },
      ]);
      toast.success("Add-on created");
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Your add-ons
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Create reusable extras (breakfast, transfers, activities) and assign
          them to listings or rooms from the listing editor. Guests select them
          at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {addons.length === 0 ? (
          <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center text-sm text-brand-mute">
            No add-ons yet. Create your first one to start offering extras.
          </div>
        ) : (
          <div className="space-y-3">
            {addons.map((addon) => (
              <AddonRow
                key={addon.id}
                addon={addon}
                onUpdated={(updated) =>
                  setAddons(
                    addons.map((a) => (a.id === addon.id ? updated : a)),
                  )
                }
                onDeleted={() =>
                  setAddons(addons.filter((a) => a.id !== addon.id))
                }
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={addAddon}
            disabled={createPending}
            variant="outline"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {createPending ? "Creating…" : "Add an add-on"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddonRow({
  addon,
  onUpdated,
  onDeleted,
}: {
  addon: AddonCard;
  onUpdated: (addon: AddonCard) => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [togglePending, startToggle] = useTransition();

  const [name, setName] = useState(addon.name);
  const [description, setDescription] = useState(addon.description ?? "");
  const [pricingModel, setPricingModel] = useState<PricingModel>(
    addon.pricingModel,
  );
  const [unitPrice, setUnitPrice] = useState(numToStr(addon.unitPrice, "0"));
  const [minQty, setMinQty] = useState(numToStr(addon.minQuantity, "1"));
  const [maxQty, setMaxQty] = useState(numToStr(addon.maxQuantity));
  const [isRequired, setIsRequired] = useState(addon.isRequired);
  const [isActive, setIsActive] = useState(addon.isActive);
  const [leadTime, setLeadTime] = useState(numToStr(addon.leadTimeDays, "0"));
  const [imageUrl, setImageUrl] = useState<string | null>(addon.imageUrl);

  function save() {
    startSave(async () => {
      const parsedName = name.trim();
      const parsedUnit = toNum(unitPrice);
      const parsedMin = toInt(minQty);
      const parsedLead = toInt(leadTime);
      if (!parsedName) {
        toast.error("Add a name.");
        return;
      }
      if (parsedUnit == null) {
        toast.error("Add a unit price.");
        return;
      }
      const result = await updateAddonAction(addon.id, {
        name: parsedName,
        description: description.trim().length > 0 ? description.trim() : null,
        pricing_model: pricingModel,
        unit_price: parsedUnit,
        currency: addon.currency,
        min_quantity: parsedMin ?? 1,
        max_quantity: toInt(maxQty),
        is_required: isRequired,
        is_active: isActive,
        lead_time_days: parsedLead ?? 0,
      });
      if (result.ok) {
        onUpdated({
          ...addon,
          name: parsedName,
          description: description.trim().length > 0 ? description : null,
          pricingModel,
          unitPrice: parsedUnit,
          minQuantity: parsedMin ?? 1,
          maxQuantity: toInt(maxQty),
          isRequired,
          isActive,
          leadTimeDays: parsedLead ?? 0,
          imageUrl,
        });
        toast.success("Add-on saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function remove() {
    const ok = await modal.destructive({
      title: `Delete "${addon.name}"?`,
      description:
        "It will be removed from every listing it's attached to. This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    startDelete(async () => {
      const result = await deleteAddonAction(addon.id);
      if (result.ok) {
        onDeleted();
        toast.success("Add-on deleted");
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggleActive() {
    const next = !isActive;
    startToggle(async () => {
      const result = await toggleAddonActiveAction(addon.id, next);
      if (result.ok) {
        setIsActive(next);
        onUpdated({ ...addon, isActive: next });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left hover:bg-brand-light/60"
        aria-expanded={open}
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-brand-line bg-brand-accent/40">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
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
            {!addon.isActive ? " · Hidden" : ""}
            {addon.isRequired ? " · Required" : ""}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-mute transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-brand-line bg-brand-light/30 p-4">
          <AddonImageInput
            addonId={addon.id}
            imageUrl={imageUrl}
            onChange={(url) => {
              setImageUrl(url);
              onUpdated({ ...addon, imageUrl: url });
            }}
          />

          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={savePending}
            />
          </Field>

          <Field label="Description (optional)">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={savePending}
              placeholder="What's included? Anything guests should know?"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pricing model">
              <select
                value={pricingModel}
                onChange={(e) =>
                  setPricingModel(e.target.value as PricingModel)
                }
                disabled={savePending}
                className="h-9 w-full rounded border border-brand-line bg-white px-2 text-sm"
              >
                {PRICING_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Unit price (${addon.currency})`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                disabled={savePending}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Min quantity">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                disabled={savePending}
              />
            </Field>
            <Field label="Max quantity (blank = unlimited)">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                disabled={savePending}
              />
            </Field>
            <Field label="Lead time (days)">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                disabled={savePending}
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-brand-dark">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                disabled={savePending}
                className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
              />
              Required (auto-added to every booking)
            </label>
            <label className="flex items-center gap-2 text-sm text-brand-dark">
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => toggleActive()}
                disabled={togglePending}
                className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
              />
              Active (visible to guests)
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              disabled={deletePending || savePending}
              className="gap-1.5 text-status-cancelled hover:bg-red-50 hover:text-status-cancelled"
            >
              <Trash2 className="h-4 w-4" />
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={savePending}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {savePending ? "Saving…" : "Save add-on"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
