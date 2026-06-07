"use client";

import { Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { addBookingAddonAction } from "./payment-actions";

type CatalogItem = {
  id: string;
  name: string;
  unitPrice: number;
  active: boolean;
};

export function AddonManager({
  bookingId,
  currency,
  catalog,
}: {
  bookingId: string;
  currency: string;
  catalog: CatalogItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [markPaid, setMarkPaid] = useState(false);

  function pickCatalog(id: string) {
    const item = catalog.find((c) => c.id === id);
    if (!item) return;
    setLabel(item.name);
    setUnitPrice(String(item.unitPrice));
  }

  function submit() {
    const qty = Math.max(1, Math.round(Number(quantity) || 0));
    const price = Math.round((Number(unitPrice) || 0) * 100) / 100;
    if (!label.trim()) {
      toast.error("Give the add-on a name.");
      return;
    }
    if (!(price >= 0)) {
      toast.error("Enter a valid price.");
      return;
    }
    start(async () => {
      const r = await addBookingAddonAction({
        bookingId,
        items: [{ label: label.trim(), quantity: qty, unitPrice: price }],
        markPaid,
      });
      if (r.ok) {
        toast.success(
          markPaid ? "Add-on added & paid." : "Add-on added to the balance.",
        );
        setOpen(false);
        setLabel("");
        setQuantity("1");
        setUnitPrice("");
        setMarkPaid(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
      >
        <Plus className="h-4 w-4" /> Add an add-on
      </button>
    );
  }

  const lineTotal =
    Math.round((Number(unitPrice) || 0) * (Number(quantity) || 0) * 100) / 100;

  return (
    <div className="rounded-[12px] border border-brand-line bg-brand-light/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
        <Sparkles className="h-4 w-4 text-brand-secondary" /> New add-on
      </div>

      {catalog.length > 0 ? (
        <>
          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Pick from your add-ons
            </span>
            <select
              defaultValue=""
              onChange={(e) => pickCatalog(e.target.value)}
              className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
            >
              <option value="">Choose an existing add-on…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {formatMoney(c.unitPrice, currency)}
                  {c.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-brand-line" />
            <span className="text-[11px] font-medium text-brand-mute">
              or create a manual add-on
            </span>
            <div className="h-px flex-1 bg-brand-line" />
          </div>
        </>
      ) : (
        <p className="mb-3 text-[11.5px] text-brand-mute">
          You have no saved add-ons yet — enter a manual one below.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_88px_120px]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Add-on
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Airport transfer"
            className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Qty
          </span>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Unit price
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-brand-ink">
        <input
          type="checkbox"
          checked={markPaid}
          onChange={(e) => setMarkPaid(e.target.checked)}
          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
        Mark as paid now (money already collected)
      </label>

      <p className="mt-2 text-[11.5px] text-brand-mute">
        Issues a separate invoice for {formatMoney(lineTotal, currency)}.{" "}
        {markPaid
          ? "Recorded as a paid add-on payment."
          : "Added to the outstanding balance to collect later."}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add to booking
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded border border-brand-line px-4 py-2 text-[13px] font-medium text-brand-mute transition hover:bg-white disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
