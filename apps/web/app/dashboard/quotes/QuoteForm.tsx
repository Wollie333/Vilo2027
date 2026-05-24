"use client";

import { Plus, Save, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";

import {
  createQuoteAction,
  sendQuoteAction,
  updateQuoteAction,
} from "./actions";

export type QuoteFormListing = {
  id: string;
  name: string;
  booking_mode: "whole_listing" | "rooms_only" | "flexible";
  base_price: number | null;
  cleaning_fee: number | null;
  currency: string;
};

type AddonRow = { label: string; quantity: string; unitPrice: string };

export type QuoteFormInitial = {
  id?: string;
  listingId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn?: string;
  checkOut?: string;
  headcount?: number;
  baseAmount?: number;
  cleaningFee?: number;
  notes?: string;
  addons?: { label: string; quantity: number; unit_price: number }[];
};

export function QuoteForm({
  listings,
  initial,
}: {
  listings: QuoteFormListing[];
  initial?: QuoteFormInitial;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sendingPending, startSending] = useTransition();

  const [listingId, setListingId] = useState(
    initial?.listingId ?? listings[0]?.id ?? "",
  );
  const [guestName, setGuestName] = useState(initial?.guestName ?? "");
  const [guestEmail, setGuestEmail] = useState(initial?.guestEmail ?? "");
  const [guestPhone, setGuestPhone] = useState(initial?.guestPhone ?? "");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const [headcount, setHeadcount] = useState(String(initial?.headcount ?? 2));
  const [baseAmount, setBaseAmount] = useState(
    String(initial?.baseAmount ?? ""),
  );
  const [cleaningFee, setCleaningFee] = useState(
    String(initial?.cleaningFee ?? 0),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [addons, setAddons] = useState<AddonRow[]>(
    initial?.addons?.map((a) => ({
      label: a.label,
      quantity: String(a.quantity),
      unitPrice: String(a.unit_price),
    })) ?? [],
  );

  const listing = listings.find((l) => l.id === listingId);
  const currency = listing?.currency ?? "ZAR";

  const totals = useMemo(() => {
    const base = parseFloat(baseAmount) || 0;
    const cleaning = parseFloat(cleaningFee) || 0;
    const addonsSum = addons.reduce(
      (s, a) =>
        s + (parseFloat(a.quantity) || 0) * (parseFloat(a.unitPrice) || 0),
      0,
    );
    return {
      base,
      cleaning,
      addonsSum,
      total: base + cleaning + addonsSum,
    };
  }, [baseAmount, cleaningFee, addons]);

  function addAddon() {
    setAddons((prev) => [
      ...prev,
      { label: "", quantity: "1", unitPrice: "0" },
    ]);
  }
  function updateAddon(i: number, patch: Partial<AddonRow>) {
    setAddons((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );
  }
  function removeAddon(i: number) {
    setAddons((prev) => prev.filter((_, idx) => idx !== i));
  }

  function buildInput() {
    return {
      listing_id: listingId,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      guest_phone: guestPhone.trim(),
      check_in: checkIn,
      check_out: checkOut,
      headcount: parseInt(headcount, 10) || 1,
      scope: "whole_listing" as const,
      base_amount: parseFloat(baseAmount) || 0,
      cleaning_fee: parseFloat(cleaningFee) || 0,
      currency,
      rooms: [],
      addons: addons
        .filter((a) => a.label.trim().length > 0)
        .map((a) => ({
          label: a.label.trim(),
          quantity: parseFloat(a.quantity) || 0,
          unit_price: parseFloat(a.unitPrice) || 0,
        })),
      notes: notes.trim(),
    };
  }

  function save(sendAfter: boolean) {
    const input = buildInput();
    if (!input.listing_id) {
      toast.error("Pick a listing.");
      return;
    }
    if (initial?.id) {
      start(async () => {
        const result = await updateQuoteAction(initial.id!, input);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (sendAfter) {
          startSending(async () => {
            const r = await sendQuoteAction(initial.id!);
            if (!r.ok) toast.error(r.error);
            else toast.success("Quote sent");
            router.push(`/dashboard/quotes/${initial.id}`);
          });
        } else {
          toast.success("Quote saved");
          router.push(`/dashboard/quotes/${initial.id}`);
        }
      });
    } else {
      start(async () => {
        const result = await createQuoteAction(input);
        if (!result.ok || !result.data) {
          toast.error(result.ok ? "Could not save." : result.error);
          return;
        }
        if (sendAfter) {
          const r = await sendQuoteAction(result.data.id);
          if (!r.ok) toast.error(r.error);
          else toast.success("Quote sent");
        } else {
          toast.success("Quote saved");
        }
        router.push(`/dashboard/quotes/${result.data.id}`);
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Quote details
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Pick a listing, dates and headcount. The guest doesn&rsquo;t need a
            Vilo account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <FieldLabel>Listing</FieldLabel>
            <select
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Check-in">
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </Field>
            <Field label="Check-out">
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </Field>
            <Field label="Guests">
              <Input
                type="number"
                min={1}
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Guest contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guest name">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Jane Smith"
              />
            </Field>
            <Field label="Guest email">
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </Field>
          </div>
          <Field label="Phone (optional)">
            <Input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+27 ..."
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Pricing
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Enter the total stay amount and any extras. Per-night calculator
            lands later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Base amount (${currency})`}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
              />
            </Field>
            <Field label={`Cleaning fee (${currency})`}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cleaningFee}
                onChange={(e) => setCleaningFee(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <FieldLabel>Add-ons</FieldLabel>
            <div className="mt-2 space-y-2">
              {addons.map((a, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_70px_100px_36px] gap-2"
                >
                  <Input
                    value={a.label}
                    onChange={(e) => updateAddon(i, { label: e.target.value })}
                    placeholder="Breakfast for 2"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={a.quantity}
                    onChange={(e) =>
                      updateAddon(i, { quantity: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={a.unitPrice}
                    onChange={(e) =>
                      updateAddon(i, { unitPrice: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeAddon(i)}
                    aria-label="Remove add-on"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addAddon}
              className="mt-2 gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add line item
            </Button>
          </div>

          <div className="rounded border border-brand-line bg-brand-light/50 p-3 text-sm">
            <SummaryRow label="Base" value={fmt(totals.base, currency)} />
            <SummaryRow
              label="Cleaning"
              value={fmt(totals.cleaning, currency)}
            />
            <SummaryRow
              label="Add-ons"
              value={fmt(totals.addonsSum, currency)}
            />
            <div className="mt-2 flex items-center justify-between border-t border-brand-line pt-2">
              <span className="font-display text-base font-bold text-brand-ink">
                Total
              </span>
              <span className="font-display text-lg font-bold text-brand-primary">
                {fmt(totals.total, currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the guest should know — special arrangements, late check-in, etc."
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => save(false)}
          disabled={pending || sendingPending}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {pending && !sendingPending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="button"
          onClick={() => save(true)}
          disabled={pending || sendingPending}
          className="gap-1.5"
        >
          <Send className="h-4 w-4" />
          {sendingPending ? "Sending…" : "Save & send"}
        </Button>
      </div>
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
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-brand-mute">{label}</span>
      <span className="text-brand-ink">{value}</span>
    </div>
  );
}

function fmt(amount: number, currency: string): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  return `${symbol} ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}
