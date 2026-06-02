"use client";

import { Calculator, Plus, Save, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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
  priceQuoteAction,
  sendQuoteAction,
  updateQuoteAction,
} from "./actions";

export type QuoteFormRoom = {
  id: string;
  name: string;
  base_price: number | null;
  cleaning_fee: number | null;
  max_guests: number | null;
  base_occupancy: number | null;
};

export type QuoteFormAddon = {
  id: string;
  name: string;
  pricing_model: string;
  unit_price: number;
  currency: string;
  min_quantity: number;
  max_quantity: number | null;
};

export type QuoteFormListing = {
  id: string;
  name: string;
  booking_mode: "whole_listing" | "rooms_only" | "flexible";
  base_price: number | null;
  cleaning_fee: number | null;
  currency: string;
  rooms: QuoteFormRoom[];
  addons: QuoteFormAddon[];
};

type AddonRow = { label: string; quantity: string; unitPrice: string };
type PricedRoom = {
  room_id: string;
  base_amount: number;
  cleaning_fee: number;
};

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

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const f = new Date(`${checkIn}T00:00:00Z`).getTime();
  const t = new Date(`${checkOut}T00:00:00Z`).getTime();
  const n = Math.round((t - f) / 86_400_000);
  return n > 0 ? n : 0;
}

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
  const [pricing, startPricing] = useTransition();

  const [listingId, setListingId] = useState(
    initial?.listingId ?? listings[0]?.id ?? "",
  );
  const [guestName, setGuestName] = useState(initial?.guestName ?? "");
  const [guestEmail, setGuestEmail] = useState(initial?.guestEmail ?? "");
  const [guestPhone, setGuestPhone] = useState(initial?.guestPhone ?? "");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const [headcount, setHeadcount] = useState(String(initial?.headcount ?? 2));
  const [scope, setScope] = useState<"whole_listing" | "rooms">(
    "whole_listing",
  );
  const [baseAmount, setBaseAmount] = useState(
    String(initial?.baseAmount ?? ""),
  );
  const [cleaningFee, setCleaningFee] = useState(
    String(initial?.cleaningFee ?? 0),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Per-room selection + the engine-priced amounts for the chosen rooms.
  const [roomGuests, setRoomGuests] = useState<Record<string, string>>({});
  const [selectedRooms, setSelectedRooms] = useState<Record<string, boolean>>(
    {},
  );
  const [pricedRooms, setPricedRooms] = useState<PricedRoom[]>([]);

  // Catalog add-ons (ticked from the host's catalog) + free-form custom lines.
  const [catalogSel, setCatalogSel] = useState<Record<string, string>>({}); // addonId → qty
  const [customAddons, setCustomAddons] = useState<AddonRow[]>(
    initial?.addons?.map((a) => ({
      label: a.label,
      quantity: String(a.quantity),
      unitPrice: String(a.unit_price),
    })) ?? [],
  );

  const listing = listings.find((l) => l.id === listingId);
  const currency = listing?.currency ?? "ZAR";
  const hasRooms = (listing?.rooms.length ?? 0) > 0;
  const nights = nightsBetween(checkIn, checkOut);

  // Switching listing resets anything room/addon-scoped to the old listing.
  function changeListing(id: string) {
    setListingId(id);
    setSelectedRooms({});
    setRoomGuests({});
    setPricedRooms([]);
    setCatalogSel({});
    const next = listings.find((l) => l.id === id);
    setScope(
      next && next.rooms.length > 0 && next.booking_mode === "rooms_only"
        ? "rooms"
        : "whole_listing",
    );
  }

  // Catalog add-on lines — quantity is shaped per pricing model so the stored
  // subtotal (quantity × unit_price) is correct.
  const catalogLines = useMemo(() => {
    const out: { label: string; quantity: number; unit_price: number }[] = [];
    for (const a of listing?.addons ?? []) {
      const raw = catalogSel[a.id];
      if (raw == null) continue;
      const chosen = parseInt(raw, 10);
      if (!Number.isFinite(chosen) || chosen <= 0) continue;
      let quantity = chosen;
      if (a.pricing_model === "per_night") quantity = Math.max(1, nights || 1);
      if (a.pricing_model === "per_person")
        quantity = Math.max(1, parseInt(headcount, 10) || 1);
      out.push({ label: a.name, quantity, unit_price: a.unit_price });
    }
    return out;
  }, [listing, catalogSel, nights, headcount]);

  const totals = useMemo(() => {
    const base =
      scope === "rooms"
        ? pricedRooms.reduce((s, r) => s + r.base_amount, 0)
        : parseFloat(baseAmount) || 0;
    const cleaning =
      scope === "rooms"
        ? pricedRooms.reduce((s, r) => s + r.cleaning_fee, 0)
        : parseFloat(cleaningFee) || 0;
    const catalogSum = catalogLines.reduce(
      (s, a) => s + a.quantity * a.unit_price,
      0,
    );
    const customSum = customAddons.reduce(
      (s, a) =>
        s + (parseFloat(a.quantity) || 0) * (parseFloat(a.unitPrice) || 0),
      0,
    );
    const addonsSum = catalogSum + customSum;
    return { base, cleaning, addonsSum, total: base + cleaning + addonsSum };
  }, [scope, pricedRooms, baseAmount, cleaningFee, catalogLines, customAddons]);

  function toggleRoom(roomId: string) {
    setSelectedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }));
    setPricedRooms([]); // selection changed → re-price needed
  }

  const datesValid = !!checkIn && !!checkOut && nights > 0;

  const priceStayNow = useCallback(
    (silent: boolean) => {
      if (!listingId) {
        if (!silent) toast.error("Pick a listing first.");
        return;
      }
      if (!checkIn || !checkOut || nights <= 0) {
        if (!silent) toast.error("Set valid check-in and check-out dates.");
        return;
      }
      const chosenRooms = (listing?.rooms ?? [])
        .filter((r) => selectedRooms[r.id])
        .map((r) => ({
          room_id: r.id,
          guests: parseInt(roomGuests[r.id] ?? "", 10) || r.base_occupancy || 1,
        }));
      if (scope === "rooms" && chosenRooms.length === 0) {
        if (!silent) toast.error("Select at least one room.");
        return;
      }

      startPricing(async () => {
        const r = await priceQuoteAction({
          listing_id: listingId,
          check_in: checkIn,
          check_out: checkOut,
          scope,
          guests: parseInt(headcount, 10) || 1,
          rooms: chosenRooms,
        });
        if (!r.ok || !r.data) {
          if (!silent)
            toast.error(r.ok ? "Could not price this stay." : r.error);
          return;
        }
        if (scope === "rooms") {
          setPricedRooms(r.data.rooms);
        } else {
          setBaseAmount(String(r.data.base_amount));
          setCleaningFee(String(r.data.cleaning_fee));
        }
        if (!silent)
          toast.success(
            `Priced ${r.data.nights} night${r.data.nights === 1 ? "" : "s"} from your calendar`,
          );
      });
    },
    [
      listingId,
      checkIn,
      checkOut,
      nights,
      scope,
      headcount,
      selectedRooms,
      roomGuests,
      listing,
    ],
  );

  // Auto-price from the calendar the moment there's enough to price on — dates
  // set (and, for a per-room quote, at least one room ticked). No button click
  // needed; the amounts flow straight into the totals. It only re-fires when the
  // dates / rooms / guests / listing change, so a host can still hand-edit the
  // figure afterwards without it being wiped. The button is just a manual
  // re-price for when they want to snap back to the calculated price.
  useEffect(() => {
    if (!datesValid) return;
    if (scope === "rooms") {
      const anyRoom = (listing?.rooms ?? []).some((r) => selectedRooms[r.id]);
      if (!anyRoom) {
        setPricedRooms([]);
        return;
      }
    }
    priceStayNow(true);
  }, [
    scope,
    datesValid,
    listing,
    selectedRooms,
    roomGuests,
    headcount,
    priceStayNow,
  ]);

  function addCustom() {
    setCustomAddons((p) => [
      ...p,
      { label: "", quantity: "1", unitPrice: "0" },
    ]);
  }
  function updateCustom(i: number, patch: Partial<AddonRow>) {
    setCustomAddons((p) =>
      p.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );
  }
  function removeCustom(i: number) {
    setCustomAddons((p) => p.filter((_, idx) => idx !== i));
  }

  function buildInput() {
    const addons = [
      ...catalogLines,
      ...customAddons
        .filter((a) => a.label.trim().length > 0)
        .map((a) => ({
          label: a.label.trim(),
          quantity: parseFloat(a.quantity) || 0,
          unit_price: parseFloat(a.unitPrice) || 0,
        })),
    ];
    return {
      listing_id: listingId,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      guest_phone: guestPhone.trim(),
      check_in: checkIn,
      check_out: checkOut,
      headcount: parseInt(headcount, 10) || 1,
      scope,
      base_amount: totals.base,
      cleaning_fee: totals.cleaning,
      currency,
      rooms: scope === "rooms" ? pricedRooms : [],
      addons,
      notes: notes.trim(),
    };
  }

  function save(sendAfter: boolean) {
    const input = buildInput();
    if (!input.listing_id) return toast.error("Pick a listing.");
    if (input.scope === "rooms" && input.rooms.length === 0)
      return toast.error("Select rooms and click “Price from calendar” first.");

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

  const busy = pending || sendingPending || pricing;

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
              onChange={(e) => changeListing(e.target.value)}
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

          {hasRooms ? (
            <div>
              <FieldLabel>What are you quoting?</FieldLabel>
              <div className="mt-1 flex gap-2">
                <ScopeChip
                  active={scope === "whole_listing"}
                  onClick={() => {
                    setScope("whole_listing");
                    setPricedRooms([]);
                  }}
                  label="Whole listing"
                />
                <ScopeChip
                  active={scope === "rooms"}
                  onClick={() => setScope("rooms")}
                  label="Specific rooms"
                />
              </div>
            </div>
          ) : null}
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

      {/* Rooms picker — only for per-room quotes. */}
      {scope === "rooms" && hasRooms ? (
        <Card className="rounded-card border-brand-line shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-xl font-bold text-brand-dark">
              Rooms
            </CardTitle>
            <CardDescription className="text-brand-mute">
              Tick the rooms this quote covers — they&rsquo;re priced
              automatically from your live calendar (seasonal &amp; weekend
              rates included).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(listing?.rooms ?? []).map((r) => {
              const priced = pricedRooms.find((p) => p.room_id === r.id);
              return (
                <label
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded border border-brand-line bg-white px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedRooms[r.id]}
                    onChange={() => toggleRoom(r.id)}
                  />
                  <span className="font-medium text-brand-ink">{r.name}</span>
                  {selectedRooms[r.id] ? (
                    <span className="ml-auto flex items-center gap-2 text-xs text-brand-mute">
                      <span>Guests</span>
                      <Input
                        type="number"
                        min={1}
                        max={r.max_guests ?? undefined}
                        value={
                          roomGuests[r.id] ?? String(r.base_occupancy ?? 1)
                        }
                        onChange={(e) =>
                          setRoomGuests((p) => ({
                            ...p,
                            [r.id]: e.target.value,
                          }))
                        }
                        className="h-8 w-16"
                      />
                      {priced ? (
                        <span className="font-medium text-brand-ink">
                          {fmt(
                            priced.base_amount + priced.cleaning_fee,
                            currency,
                          )}
                        </span>
                      ) : pricing && datesValid ? (
                        <span className="text-brand-mute">Pricing…</span>
                      ) : !datesValid ? (
                        <span className="text-brand-mute">Add dates</span>
                      ) : r.base_price != null ? (
                        <span className="text-brand-mute">
                          ~{fmt(r.base_price, currency)}/night
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Pricing
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Priced automatically from your calendar (seasonal &amp; weekend
            rates included) once dates are set — fine-tune anything below.
            Add-ons are charged on top.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => priceStayNow(false)}
              disabled={busy || !datesValid}
              className="gap-1.5"
            >
              <Calculator className="h-4 w-4" />
              {pricing ? "Pricing…" : "Re-price from calendar"}
            </Button>
            {!datesValid ? (
              <span className="text-xs text-brand-mute">
                Add check-in &amp; check-out dates above to price.
              </span>
            ) : null}
          </div>

          {scope === "whole_listing" ? (
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
          ) : (
            <p className="text-xs text-brand-mute">
              Per-room amounts come from your calendar once you price the
              selected rooms above.
            </p>
          )}

          {/* Catalog add-ons */}
          {listing && listing.addons.length > 0 ? (
            <div>
              <FieldLabel>Add-ons from your catalog</FieldLabel>
              <div className="mt-2 space-y-1.5">
                {listing.addons.map((a) => {
                  const checked = catalogSel[a.id] != null;
                  return (
                    <label
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 rounded border border-brand-line bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setCatalogSel((p) => {
                            const next = { ...p };
                            if (e.target.checked)
                              next[a.id] = String(a.min_quantity || 1);
                            else delete next[a.id];
                            return next;
                          })
                        }
                      />
                      <span className="font-medium text-brand-ink">
                        {a.name}
                      </span>
                      <span className="text-xs text-brand-mute">
                        {fmt(a.unit_price, a.currency)} ·{" "}
                        {a.pricing_model.replace(/_/g, " ")}
                      </span>
                      {checked && a.pricing_model === "per_unit" ? (
                        <Input
                          type="number"
                          min={1}
                          max={a.max_quantity ?? undefined}
                          value={catalogSel[a.id]}
                          onChange={(e) =>
                            setCatalogSel((p) => ({
                              ...p,
                              [a.id]: e.target.value,
                            }))
                          }
                          className="ml-auto h-8 w-16"
                        />
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Custom line items */}
          <div>
            <FieldLabel>Custom line items</FieldLabel>
            <div className="mt-2 space-y-2">
              {customAddons.map((a, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_70px_100px_36px] gap-2"
                >
                  <Input
                    value={a.label}
                    onChange={(e) => updateCustom(i, { label: e.target.value })}
                    placeholder="Early check-in"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={a.quantity}
                    onChange={(e) =>
                      updateCustom(i, { quantity: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={a.unitPrice}
                    onChange={(e) =>
                      updateCustom(i, { unitPrice: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeCustom(i)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addCustom}
              className="mt-2 gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add line item
            </Button>
          </div>

          <div className="rounded border border-brand-line bg-brand-light/50 p-3 text-sm">
            <SummaryRow
              label="Accommodation"
              value={fmt(totals.base, currency)}
            />
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
          disabled={busy}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {pending && !sendingPending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="button"
          onClick={() => save(true)}
          disabled={busy}
          className="gap-1.5"
        >
          <Send className="h-4 w-4" />
          {sendingPending ? "Sending…" : "Save & send"}
        </Button>
      </div>
    </div>
  );
}

function ScopeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-brand-primary text-white"
          : "border border-brand-line bg-white text-brand-mute hover:text-brand-ink"
      }`}
    >
      {label}
    </button>
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
