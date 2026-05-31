"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import { createAddonAction } from "./actions";
import { PRICING_MODEL_META } from "./schemas";
import { ADDON_TEMPLATES, type AddonTemplate } from "./templates";

function fmtR(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

/**
 * "Browse templates" picker — adds ready-made extras into the host's library
 * with one click via createAddonAction. Each added add-on is a real, editable
 * record (not assigned to any listing yet, so guests don't see it until the
 * host assigns it).
 */
export function AddonTemplatesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  function add(t: AddonTemplate) {
    setBusyKey(t.key);
    start(async () => {
      const res = await createAddonAction({
        name: t.name,
        description: t.description,
        pricing_model: t.pricingModel,
        unit_price: t.unitPrice,
        currency: "ZAR",
        min_quantity: t.minQuantity,
        max_quantity: t.maxQuantity,
        allow_custom_quantity: true,
        stock_quantity: null,
        is_required: false,
        is_active: true,
        lead_time_days: t.leadTimeDays,
        category: t.category,
        vat_included: false,
        daily_capacity: null,
      });
      setBusyKey(null);
      if (res.ok) {
        setAdded((s) => new Set(s).add(t.key));
        toast.success(`Added “${t.name}” to your add-ons`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add-on templates"
      description="Add ready-made extras to your library — tweak the price or details any time."
      size="lg"
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ADDON_TEMPLATES.map((t) => {
          const Icon = t.icon;
          const isAdded = added.has(t.key);
          const meta = PRICING_MODEL_META[t.pricingModel];
          const busy = pending && busyKey === t.key;
          return (
            <div
              key={t.key}
              className="flex gap-3 rounded-card border border-brand-line bg-white p-3.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-brand-ink">
                  {t.name}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-brand-mute">
                  {t.description}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-semibold text-brand-ink">
                      {fmtR(t.unitPrice)}
                    </span>{" "}
                    <span className="text-brand-mute">· {meta.suffix}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => add(t)}
                    disabled={isAdded || busy}
                    className={`inline-flex shrink-0 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                      isAdded
                        ? "bg-brand-accent text-brand-secondary"
                        : "bg-brand-primary text-white hover:bg-brand-secondary"
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Added
                      </>
                    ) : busy ? (
                      "Adding…"
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FormModalFooter>
        <FormModalCancel>Done</FormModalCancel>
      </FormModalFooter>
    </FormModal>
  );
}
