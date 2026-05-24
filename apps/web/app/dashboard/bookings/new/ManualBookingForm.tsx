"use client";

import { Plus, Save, Trash2 } from "lucide-react";
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

import type { QuoteFormListing } from "../../quotes/QuoteForm";

import { createManualBookingAction } from "./actions";

type AddonRow = { label: string; quantity: string; unitPrice: string };
type PayState = "paid" | "unpaid" | "send_paystack_link";

export function ManualBookingForm({
  listings,
}: {
  listings: QuoteFormListing[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [listingId, setListingId] = useState(listings[0]?.id ?? "");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [headcount, setHeadcount] = useState("2");
  const [baseAmount, setBaseAmount] = useState("");
  const [cleaningFee, setCleaningFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [paymentState, setPaymentState] = useState<PayState>("paid");
  const [paymentNote, setPaymentNote] = useState("");

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
    return { base, cleaning, addonsSum, total: base + cleaning + addonsSum };
  }, [baseAmount, cleaningFee, addons]);

  function addAddon() {
    setAddons((p) => [...p, { label: "", quantity: "1", unitPrice: "0" }]);
  }
  function patchAddon(i: number, patch: Partial<AddonRow>) {
    setAddons((p) => p.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function removeAddon(i: number) {
    setAddons((p) => p.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!listingId) {
      toast.error("Pick a listing.");
      return;
    }
    start(async () => {
      const r = await createManualBookingAction({
        listing_id: listingId,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim(),
        check_in: checkIn,
        check_out: checkOut,
        headcount: parseInt(headcount, 10) || 1,
        scope: "whole_listing",
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
        payment_state: paymentState,
        payment_note: paymentNote.trim(),
      });
      if (r.ok && r.data) {
        toast.success("Booking created");
        router.push(`/dashboard/bookings/${r.data.bookingId}`);
      } else if (!r.ok) {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Stay
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Walk-in or phone-in. The guest doesn&rsquo;t need a Vilo account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Listing">
            <select
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className="block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
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
              />
            </Field>
            <Field label="Guest email">
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Phone (optional)">
            <Input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Pricing &amp; payment
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Total stay amount plus extras. Pick how this booking is paid for.
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
                    onChange={(e) => patchAddon(i, { label: e.target.value })}
                    placeholder="e.g. Breakfast"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={a.quantity}
                    onChange={(e) =>
                      patchAddon(i, { quantity: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={a.unitPrice}
                    onChange={(e) =>
                      patchAddon(i, { unitPrice: e.target.value })
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

          <div>
            <FieldLabel>Payment state</FieldLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(
                [
                  { v: "paid", label: "Paid (cash / EFT / other)" },
                  { v: "unpaid", label: "Unpaid — collect later" },
                  { v: "send_paystack_link", label: "Send Paystack link" },
                ] as { v: PayState; label: string }[]
              ).map((opt) => {
                const active = paymentState === opt.v;
                return (
                  <button
                    type="button"
                    key={opt.v}
                    onClick={() => setPaymentState(opt.v)}
                    className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                        : "border-brand-line bg-white text-brand-mute hover:bg-brand-light/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {paymentState === "paid" ? (
              <Input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Payment note (cash receipt, EFT ref, etc.)"
                className="mt-3"
              />
            ) : null}
            {paymentState === "send_paystack_link" ? (
              <p className="mt-2 text-xs text-brand-mute">
                Booking will be created as <code>pending</code>. Hosted Paystack
                link emailing lands in a follow-up — for now, send the guest a
                payment link from the booking detail page.
              </p>
            ) : null}
          </div>

          <div className="rounded border border-brand-line bg-brand-light/40 p-3 text-sm">
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
            Notes (optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={submit}
          disabled={pending}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {pending ? "Creating…" : "Create booking"}
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
