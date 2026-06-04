"use client";

import {
  ArrowRight,
  BedDouble,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  Link2,
  MapPin,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { formatMoney } from "@/lib/format";

import { computeAddonSubtotal, PRICING_LABEL } from "../../addons/schemas";

import { createManualBookingAction } from "./actions";

// ── Data shapes (loaded server-side in page.tsx) ─────────────────────────
export type BookingListing = {
  id: string;
  name: string;
  booking_mode: "whole_listing" | "rooms_only" | "flexible";
  base_price: number | null;
  cleaning_fee: number | null;
  currency: string;
  photo_url: string | null;
  location: string | null;
  max_guests: number | null;
};
export type BookingRoom = {
  id: string;
  listing_id: string;
  name: string;
  base_price: number;
  cleaning_fee: number;
  max_guests: number;
  bed_type: string | null;
  view_type: string | null;
  has_ensuite: boolean;
  photo_url: string | null;
  pricing_mode: "per_room" | "per_person" | "per_room_plus_extra";
  price_per_person: number | null;
};

/** A room's "from" nightly figure for prefill — per-person rooms quote /person. */
function roomFromNightly(r: BookingRoom): number {
  return r.pricing_mode === "per_person"
    ? (r.price_per_person ?? 0)
    : r.base_price;
}
export type BookingAddon = {
  id: string;
  listing_id: string;
  name: string;
  description: string | null;
  unit_price: number;
  currency: string;
  pricing_model: string;
  min_quantity: number;
  max_quantity: number | null;
  is_required: boolean;
};
export type BookingBlocked = {
  listing_id: string;
  room_id: string | null;
  date: string;
};
export type PastGuest = {
  name: string;
  email: string;
  phone: string | null;
  stays: number;
  lastStay: string | null;
};

type PayState = "send_paystack_link" | "paid" | "unpaid";
type CustomFee = { id: number; label: string; amount: string };

// ── Date helpers (local time; the calendar works in YYYY-MM-DD) ─────────
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const diffNights = (ci: string, co: string) =>
  Math.round((parseYmd(co).getTime() - parseYmd(ci).getTime()) / 86400000);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FIELD =
  "w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13.5px] text-brand-ink transition focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15 placeholder:text-brand-mute/70";

export function ManualBookingForm({
  listings,
  rooms,
  addons,
  blocked,
  pastGuests,
}: {
  listings: BookingListing[];
  rooms: BookingRoom[];
  addons: BookingAddon[];
  blocked: BookingBlocked[];
  pastGuests: PastGuest[];
}) {
  const router = useRouter();
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  const todayStr = ymd(new Date());

  const [listingId, setListingId] = useState(listings[0]?.id ?? "");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [wholeListing, setWholeListing] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [guestSearch, setGuestSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [matchedGuest, setMatchedGuest] = useState<PastGuest | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [nightlyRate, setNightlyRate] = useState("");
  const [cleaningFee, setCleaningFee] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [customFees, setCustomFees] = useState<CustomFee[]>([]);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});

  const [paymentState, setPaymentState] = useState<PayState>("paid");
  const [paymentNote, setPaymentNote] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const [viewStart, setViewStart] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const listing = listings.find((l) => l.id === listingId);
  const currency = listing?.currency ?? "ZAR";
  const listingRooms = useMemo(
    () => rooms.filter((r) => r.listing_id === listingId),
    [rooms, listingId],
  );
  const listingAddons = useMemo(
    () => addons.filter((a) => a.listing_id === listingId),
    [addons, listingId],
  );
  const hasRooms = listingRooms.length > 0;
  const selectedRoom = listingRooms.find((r) => r.id === roomId) ?? null;
  const scope: "whole_listing" | "rooms" =
    hasRooms && !wholeListing && selectedRoom ? "rooms" : "whole_listing";

  const nights =
    checkIn && checkOut ? Math.max(0, diffNights(checkIn, checkOut)) : 0;

  // Reset listing-dependent state when the listing changes.
  useEffect(() => {
    setRoomId(null);
    setWholeListing(false);
    setCustomFees([]);
    setAddonQty({});
  }, [listingId]);

  // Prefill nightly rate + cleaning from the chosen room (room scope) or the
  // listing. Re-runs when the pricing source changes; host can still edit.
  useEffect(() => {
    if (hasRooms && !wholeListing && selectedRoom) {
      setNightlyRate(String(roomFromNightly(selectedRoom)));
      setCleaningFee(String(selectedRoom.cleaning_fee));
    } else if (listing) {
      const fallback =
        (listing.base_price ??
          listingRooms.reduce((s, r) => s + roomFromNightly(r), 0)) ||
        0;
      setNightlyRate(String(fallback));
      setCleaningFee(String(listing.cleaning_fee ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, roomId, wholeListing]);

  // ── Availability ──────────────────────────────────────────────────────
  const listingBlocks = useMemo(
    () => blocked.filter((b) => b.listing_id === listingId),
    [blocked, listingId],
  );
  function isNightBlocked(dateStr: string): boolean {
    return listingBlocks.some(
      (b) =>
        b.date === dateStr &&
        (scope === "whole_listing"
          ? true
          : b.room_id === null || b.room_id === roomId),
    );
  }
  function rangeBlocked(ci: string, co: string): boolean {
    for (let d = ci; d < co; d = addDays(d, 1)) {
      if (isNightBlocked(d)) return true;
    }
    return false;
  }
  function roomUnavailable(room: BookingRoom): boolean {
    if (!checkIn || !checkOut || nights <= 0) return false;
    for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
      if (
        listingBlocks.some(
          (b) => b.date === d && (b.room_id === null || b.room_id === room.id),
        )
      )
        return true;
    }
    return false;
  }
  const rangeConflict =
    checkIn && checkOut && nights > 0 ? rangeBlocked(checkIn, checkOut) : false;

  // ── Date picking ──────────────────────────────────────────────────────
  function pickDate(dateStr: string) {
    if (dateStr < todayStr) return;
    if (isNightBlocked(dateStr)) {
      toast.error("That night is already blocked.");
      return;
    }
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dateStr);
      setCheckOut("");
      return;
    }
    if (dateStr <= checkIn) {
      setCheckIn(dateStr);
      setCheckOut("");
      return;
    }
    if (rangeBlocked(checkIn, dateStr)) {
      toast.error("That range crosses a blocked night.");
      setCheckIn(dateStr);
      setCheckOut("");
      return;
    }
    setCheckOut(dateStr);
  }
  function quickRange(startOffset: number, len: number) {
    const ci = addDays(todayStr, startOffset);
    const co = addDays(ci, len);
    if (rangeBlocked(ci, co)) {
      toast.error("Those dates aren't all free.");
      return;
    }
    setCheckIn(ci);
    setCheckOut(co);
  }
  function thisWeekend() {
    const t = new Date();
    const day = t.getDay(); // 0 Sun .. 6 Sat
    const toFri = (5 - day + 7) % 7;
    const ci = addDays(todayStr, toFri);
    quickRangeExact(ci, addDays(ci, 2));
  }
  function quickRangeExact(ci: string, co: string) {
    if (rangeBlocked(ci, co)) {
      toast.error("Those dates aren't all free.");
      return;
    }
    setCheckIn(ci);
    setCheckOut(co);
  }

  // ── Pricing ───────────────────────────────────────────────────────────
  const nightly = parseFloat(nightlyRate) || 0;
  const cleaning = parseFloat(cleaningFee) || 0;
  const discountVal = parseFloat(discount) || 0;
  const grossBase = nightly * nights;
  const netBase = Math.max(0, grossBase - discountVal);

  const addonLines = useMemo(() => {
    const configured = listingAddons
      .filter((a) => (addonQty[a.id] ?? 0) > 0)
      .map((a) => {
        const qty = addonQty[a.id] ?? 0;
        const subtotal = computeAddonSubtotal(
          (a.pricing_model as keyof typeof PRICING_LABEL) ?? "per_stay",
          a.unit_price,
          qty,
          adults + children,
        );
        return {
          key: a.id,
          addon_id: a.id,
          label: a.name,
          quantity: qty,
          unit_price: a.unit_price,
          pricing_model: a.pricing_model,
          subtotal,
        };
      });
    const custom = customFees
      .filter((f) => f.label.trim() && (parseFloat(f.amount) || 0) > 0)
      .map((f, i) => ({
        key: `custom-${i}`,
        addon_id: null as string | null,
        label: f.label.trim(),
        quantity: 1,
        unit_price: parseFloat(f.amount) || 0,
        pricing_model: "per_stay",
        subtotal: parseFloat(f.amount) || 0,
      }));
    return [...configured, ...custom];
  }, [listingAddons, addonQty, customFees, adults, children]);

  const addonsTotal = addonLines.reduce((s, a) => s + a.subtotal, 0);
  const total = netBase + cleaning + addonsTotal;
  const headcount = Math.max(1, adults + children);

  function setQty(id: string, next: number, max: number | null) {
    // 0 deselects; the caller passes the configured minimum on first select.
    const clamped = Math.max(0, max != null ? Math.min(max, next) : next);
    setAddonQty((p) => ({ ...p, [id]: clamped }));
  }

  function pickGuest(g: PastGuest) {
    setGuestName(g.name);
    setGuestEmail(g.email);
    setGuestPhone(g.phone ?? "");
    setMatchedGuest(g);
    setGuestSearch("");
    setSearchOpen(false);
  }

  const guestMatches = useMemo(() => {
    const q = guestSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return pastGuests
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [guestSearch, pastGuests]);

  function submit() {
    if (!listingId) return toast.error("Pick a listing.");
    if (hasRooms && !wholeListing && !selectedRoom)
      return toast.error("Pick a room (or reserve the whole listing).");
    if (!checkIn || !checkOut || nights <= 0)
      return toast.error("Choose check-in and check-out dates.");
    if (rangeConflict)
      return toast.error("Those dates include blocked nights.");
    if (!guestName.trim()) return toast.error("Add the guest's name.");
    if (!guestEmail.trim()) return toast.error("Add the guest's email.");

    start(async () => {
      const r = await createManualBookingAction({
        listing_id: listingId,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim(),
        check_in: checkIn,
        check_out: checkOut,
        headcount,
        scope,
        base_amount: netBase,
        cleaning_fee: cleaning,
        currency,
        rooms:
          scope === "rooms" && selectedRoom
            ? [
                {
                  room_id: selectedRoom.id,
                  base_amount: netBase,
                  cleaning_fee: cleaning,
                },
              ]
            : [],
        addons: addonLines.map((a) => ({
          label: a.label,
          quantity: a.quantity,
          unit_price: a.unit_price,
          addon_id: a.addon_id ?? undefined,
          pricing_model: a.pricing_model,
        })),
        notes: guestMessage.trim(),
        internal_note: internalNote.trim(),
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

  let sectionNo = 0;
  const next = () => ++sectionNo;
  const ctaLabel =
    paymentState === "send_paystack_link"
      ? "Create booking & send link"
      : "Create booking";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            New booking
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Add a reservation manually
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-brand-mute">
            Useful for phone calls, walk-ins, returning guests, or imports from
            another channel. {brandName} blocks the calendar and (optionally)
            takes payment.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* LEFT — form */}
        <div className="space-y-5">
          {/* 1 · Listing */}
          <SectionCard
            n={next()}
            done={Boolean(listingId)}
            title="Which listing?"
            subtitle="Pick the property the guest will stay in."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {listings.map((l) => {
                const sel = l.id === listingId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setListingId(l.id)}
                    className={`relative flex flex-col rounded-[12px] border p-3 text-left transition ${
                      sel
                        ? "border-brand-primary bg-brand-accent/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                        : "border-brand-line hover:bg-brand-accent/20"
                    }`}
                  >
                    <div className="relative h-24 w-full overflow-hidden rounded-[8px] bg-brand-light">
                      {l.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.photo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-brand-line">
                          <MapPin className="h-6 w-6" />
                        </div>
                      )}
                      <Dot active={sel} className="absolute right-2 top-2" />
                    </div>
                    <div className="mt-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-brand-ink">
                          {l.name}
                        </div>
                        <div className="mt-0.5 truncate text-[10.5px] text-brand-mute">
                          {[
                            l.location,
                            l.max_guests ? `sleeps ${l.max_guests}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Accommodation"}
                        </div>
                      </div>
                      {l.base_price != null && (
                        <div className="text-right">
                          <div className="num font-display text-[12.5px] font-bold text-brand-ink">
                            {formatMoney(l.base_price, l.currency)}
                          </div>
                          <div className="text-[9.5px] text-brand-mute">
                            / night
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* 2 · Room (only when the listing has rooms) */}
          {hasRooms && (
            <SectionCard
              n={next()}
              done={Boolean(selectedRoom) || wholeListing}
              title="Which room?"
              subtitle={`${listing?.name ?? "This listing"} has ${listingRooms.length} room${
                listingRooms.length === 1 ? "" : "s"
              }. Pick the one this guest will use.`}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {listingRooms.map((r) => {
                  const unavailable = roomUnavailable(r);
                  const sel = !wholeListing && roomId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={unavailable || wholeListing}
                      onClick={() => setRoomId(r.id)}
                      className={`relative flex gap-3 rounded-[12px] border p-3 text-left transition ${
                        sel
                          ? "border-brand-primary bg-brand-accent/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                          : "border-brand-line hover:bg-brand-accent/20"
                      } ${unavailable || wholeListing ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-brand-light">
                        {r.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.photo_url}
                            alt=""
                            className={`h-full w-full object-cover ${unavailable ? "grayscale" : ""}`}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-brand-line">
                            <BedDouble className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-brand-ink">
                              {r.name}
                            </div>
                            <div className="mt-0.5 truncate text-[10.5px] text-brand-mute">
                              {[r.bed_type, `sleeps ${r.max_guests}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          {sel && <Dot active />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {unavailable ? (
                            <span className="inline-flex items-center gap-1 rounded-pill bg-status-cancelled/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-cancelled">
                              <span className="h-1.5 w-1.5 rounded-full bg-status-cancelled" />
                              Booked these dates
                            </span>
                          ) : (
                            <>
                              {r.view_type && (
                                <Chip tone="accent">{r.view_type}</Chip>
                              )}
                              {r.has_ensuite && <Chip>En-suite</Chip>}
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-4 py-3">
                <Switch on={wholeListing} onChange={setWholeListing} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-brand-ink">
                    Reserve the whole listing
                  </div>
                  <div className="text-[11px] text-brand-mute">
                    Blocks every room — useful for families or events.
                  </div>
                </div>
              </label>
            </SectionCard>
          )}

          {/* 3 · Dates */}
          <SectionCard
            n={next()}
            done={Boolean(checkIn && checkOut && nights > 0 && !rangeConflict)}
            title="Stay dates"
            subtitle={`${brandName} blocks the calendar across the stay. Hatched cells are already booked.`}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
              <ReadField
                label="Check-in"
                value={checkIn ? prettyDate(checkIn) : "—"}
              />
              <ReadField
                label="Check-out"
                value={checkOut ? prettyDate(checkOut) : "—"}
              />
              <div>
                <FieldLabel>Nights</FieldLabel>
                <div className="mt-1.5 flex h-[38px] items-center gap-2 rounded-[10px] border border-brand-line bg-brand-light/50 px-3">
                  <span className="num font-display text-[18px] font-bold text-brand-ink">
                    {nights}
                  </span>
                  <span className="text-[11px] text-brand-mute">
                    {nights === 1 ? "night" : "nights"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-brand-mute">
                Quick add:
              </span>
              <QuickChip onClick={() => quickRange(0, 1)}>Tonight</QuickChip>
              <QuickChip onClick={thisWeekend}>This weekend</QuickChip>
              <QuickChip onClick={() => quickRange(0, 7)}>
                Next 7 nights
              </QuickChip>
            </div>

            {rangeConflict && (
              <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-status-cancelled/40 bg-status-cancelled/10 px-3 py-2 text-[12px] text-status-cancelled">
                <Info className="h-4 w-4 shrink-0" />
                These dates overlap nights that are already blocked. Pick a
                clear range.
              </div>
            )}

            <div className="mt-5 grid gap-5 rounded-[12px] border border-brand-line bg-brand-light/30 p-4 sm:grid-cols-2">
              <MonthGrid
                year={viewStart.year}
                month={viewStart.month}
                showPrev
                onPrev={() => shiftMonth(viewStart, -1, setViewStart)}
                checkIn={checkIn}
                checkOut={checkOut}
                todayStr={todayStr}
                isBlocked={isNightBlocked}
                onPick={pickDate}
              />
              <MonthGrid
                year={
                  viewStart.month === 11 ? viewStart.year + 1 : viewStart.year
                }
                month={(viewStart.month + 1) % 12}
                showNext
                onNext={() => shiftMonth(viewStart, 1, setViewStart)}
                checkIn={checkIn}
                checkOut={checkOut}
                todayStr={todayStr}
                isBlocked={isNightBlocked}
                onPick={pickDate}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-brand-mute">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-brand-primary" />
                Selected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-brand-accent" />
                Range
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, #F0FDF4, #F0FDF4 2px, #DCEAE0 2px, #DCEAE0 3px)",
                  }}
                />
                Unavailable
              </span>
            </div>
          </SectionCard>

          {/* 4 · Guest party */}
          <SectionCard
            n={next()}
            done
            title="Guest party"
            subtitle={
              listing?.max_guests
                ? `${listing.name} sleeps ${listing.max_guests}.`
                : "How many guests are staying?"
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <CounterRow
                label="Adults"
                hint="13+"
                value={adults}
                min={1}
                onChange={setAdults}
              />
              <CounterRow
                label="Children"
                hint="2–12"
                value={children}
                min={0}
                onChange={setChildren}
              />
            </div>
          </SectionCard>

          {/* 5 · Lead guest */}
          <SectionCard
            n={next()}
            done={Boolean(guestName.trim() && guestEmail.trim())}
            title="Lead guest"
            subtitle="The person who'll get the confirmation. Search your past guests to reuse details."
          >
            {pastGuests.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
                <input
                  className={`${FIELD} pl-9`}
                  placeholder="Search past guests by name or email…"
                  value={guestSearch}
                  onChange={(e) => {
                    setGuestSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                />
                {searchOpen && guestMatches.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-[10px] border border-brand-line bg-white shadow-lift">
                    {guestMatches.map((g) => (
                      <li key={g.email}>
                        <button
                          type="button"
                          onClick={() => pickGuest(g)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-brand-accent/30"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium text-brand-ink">
                              {g.name || g.email}
                            </span>
                            <span className="block truncate text-[11px] text-brand-mute">
                              {g.email}
                            </span>
                          </span>
                          <Chip tone="accent">
                            {g.stays} stay{g.stays === 1 ? "" : "s"}
                          </Chip>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {matchedGuest && (
              <div className="mb-4 flex items-center gap-3 rounded-[10px] border border-brand-primary/40 bg-brand-accent/30 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-gradient text-[12px] font-bold text-white">
                  {initials(matchedGuest.name || matchedGuest.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-brand-ink">
                    <span className="font-semibold">Returning guest:</span>
                    <span>{matchedGuest.name || matchedGuest.email}</span>
                    <Chip tone="accent">
                      {matchedGuest.stays} stay
                      {matchedGuest.stays === 1 ? "" : "s"}
                    </Chip>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-brand-mute">
                    {matchedGuest.email}
                    {matchedGuest.lastStay
                      ? ` · last stay ${prettyMonth(matchedGuest.lastStay)}`
                      : ""}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Full name *</FieldLabel>
                <input
                  className={`${FIELD} mt-1.5`}
                  placeholder="e.g. Aisha Patel"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Email *</FieldLabel>
                <input
                  type="email"
                  className={`${FIELD} mt-1.5`}
                  placeholder="guest@email.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input
                  type="tel"
                  className={`${FIELD} mt-1.5`}
                  placeholder="+27 …"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
            </div>
          </SectionCard>

          {/* 6 · Pricing */}
          <SectionCard
            n={next()}
            done
            title="Pricing"
            subtitle="Auto-filled from your listing rates. Adjust for a friends-and-family rate."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyField
                label="Nightly rate"
                value={nightlyRate}
                onChange={setNightlyRate}
                hint={
                  listing?.base_price != null
                    ? `Default · ${formatMoney(listing.base_price, currency)}`
                    : undefined
                }
                symbol={symbolFor(currency)}
              />
              <MoneyField
                label="Cleaning fee"
                value={cleaningFee}
                onChange={setCleaningFee}
                hint="One-off · on top"
                symbol={symbolFor(currency)}
              />
              <MoneyField
                label="Discount"
                value={discount}
                onChange={setDiscount}
                hint="Subtracted from total"
                symbol={symbolFor(currency)}
              />
            </div>

            <div className="mt-5 space-y-2">
              {customFees.map((f, i) => (
                <div
                  key={f.id}
                  className="grid grid-cols-[1fr_140px_36px] gap-2"
                >
                  <input
                    className={FIELD}
                    placeholder="e.g. Early check-in, pet deposit"
                    value={f.label}
                    onChange={(e) =>
                      setCustomFees((p) =>
                        p.map((x, idx) =>
                          idx === i ? { ...x, label: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-brand-mute">
                      {symbolFor(currency)}
                    </span>
                    <input
                      className={`${FIELD} num pl-7`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={f.amount}
                      onChange={(e) =>
                        setCustomFees((p) =>
                          p.map((x, idx) =>
                            idx === i ? { ...x, amount: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomFees((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="flex items-center justify-center rounded-[10px] border border-brand-line text-brand-mute hover:bg-brand-accent/30"
                    aria-label="Remove fee"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCustomFees((p) => [
                    ...p,
                    {
                      id: p.reduce((m, x) => Math.max(m, x.id), 0) + 1,
                      label: "",
                      amount: "",
                    },
                  ])
                }
                className="flex items-center gap-2 rounded-[10px] border border-dashed border-brand-line px-4 py-2.5 text-[12.5px] font-medium text-brand-primary hover:bg-brand-accent/20"
              >
                <Plus className="h-4 w-4" />
                Add a custom fee
              </button>
            </div>
          </SectionCard>

          {/* 7 · Add-ons */}
          {listingAddons.length > 0 && (
            <SectionCard
              n={next()}
              done
              title="Add-ons"
              subtitle="Extras the guest can opt into. Selected items show in the summary."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {listingAddons.map((a) => {
                  const qty = addonQty[a.id] ?? 0;
                  const sel = qty > 0;
                  const min = a.min_quantity || 1;
                  return (
                    <div
                      key={a.id}
                      className={`relative flex items-start gap-3 rounded-[12px] border p-3.5 transition ${
                        sel
                          ? "border-brand-primary bg-brand-accent/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                          : "border-brand-line hover:bg-brand-accent/20"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setQty(a.id, sel ? 0 : min, a.max_quantity)
                        }
                        className="absolute inset-0 rounded-[12px]"
                        aria-label={sel ? `Remove ${a.name}` : `Add ${a.name}`}
                      />
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
                        <Plus className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-brand-ink">
                              {a.name}
                            </div>
                            {a.description && (
                              <div className="mt-0.5 text-[11px] text-brand-mute">
                                {a.description}
                              </div>
                            )}
                          </div>
                          <Dot active={sel} />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10.5px] text-brand-mute">
                            {PRICING_LABEL[
                              a.pricing_model as keyof typeof PRICING_LABEL
                            ] ?? "per stay"}
                          </span>
                          <div className="relative z-[1] flex items-center gap-2">
                            <span className="num font-display text-[13px] font-bold text-brand-ink">
                              {formatMoney(a.unit_price, a.currency)}
                            </span>
                            {sel && (
                              <Stepper
                                value={qty}
                                min={0}
                                max={a.max_quantity}
                                onChange={(v) =>
                                  setQty(a.id, v, a.max_quantity)
                                }
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {addonLines.length > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-[10px] bg-brand-accent/40 px-4 py-3">
                  <div className="flex items-center gap-2 text-[12px] text-brand-secondary">
                    <Check className="h-4 w-4" />
                    <span>
                      <span className="font-semibold">
                        {addonLines.length} item
                        {addonLines.length === 1 ? "" : "s"}
                      </span>{" "}
                      selected
                    </span>
                  </div>
                  <div className="num font-display text-[14px] font-bold text-brand-secondary">
                    + {formatMoney(addonsTotal, currency)}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* 8 · Payment */}
          <SectionCard
            n={next()}
            done
            title="Payment"
            subtitle="How is the guest paying for this stay?"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <PayCard
                active={paymentState === "send_paystack_link"}
                onClick={() => setPaymentState("send_paystack_link")}
                icon={<Link2 className="h-5 w-5" />}
                title="Send payment link"
                sub="Guest pays via Paystack. Booking stays pending until paid."
              />
              <PayCard
                active={paymentState === "paid"}
                onClick={() => setPaymentState("paid")}
                icon={<Wallet className="h-5 w-5" />}
                title="Already paid"
                sub="EFT, cash, Yoco — record off-platform. Confirms now."
              />
              <PayCard
                active={paymentState === "unpaid"}
                onClick={() => setPaymentState("unpaid")}
                icon={<CreditCard className="h-5 w-5" />}
                title="Pay at check-in"
                sub="Block the dates now, collect on arrival."
              />
            </div>

            {paymentState === "paid" && (
              <input
                className={`${FIELD} mt-4`}
                placeholder="Payment note (cash receipt, EFT ref, etc.)"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            )}
            {paymentState === "send_paystack_link" && (
              <p className="mt-3 text-[11.5px] text-brand-mute">
                The booking is created as <code>pending</code> and the calendar
                isn&rsquo;t blocked yet. Hosted-link emailing is a follow-up —
                for now, send the guest a payment link from the booking detail
                page.
              </p>
            )}
          </SectionCard>

          {/* 9 · Notes */}
          <SectionCard
            n={next()}
            done
            title="Notes & extras"
            subtitle="Optional. The internal note is for you and your staff only."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>
                  Guest message{" "}
                  <span className="font-normal normal-case tracking-normal text-brand-mute">
                    — shown to the guest
                  </span>
                </FieldLabel>
                <textarea
                  className={`${FIELD} mt-1.5 min-h-[80px]`}
                  rows={3}
                  placeholder="Hi Aisha, looking forward to having you again…"
                  value={guestMessage}
                  onChange={(e) => setGuestMessage(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>
                  Internal note{" "}
                  <span className="font-normal normal-case tracking-normal text-brand-mute">
                    — not shared
                  </span>
                </FieldLabel>
                <textarea
                  className={`${FIELD} mt-1.5 min-h-[80px]`}
                  rows={3}
                  placeholder="Returning guest, gave 5★ last time…"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT — summary */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-lift">
            {/* Dark hero */}
            <div className="relative bg-brand-gradient-dark p-5 text-white">
              <div
                aria-hidden
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(16,185,129,0.18) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              />
              <div
                aria-hidden
                className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-primary/30 blur-3xl"
              />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-accent backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                  Booking summary
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-white/10 ring-2 ring-white/20">
                    {listing?.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/40">
                        <MapPin className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-semibold leading-tight">
                      {listing?.name ?? "Pick a listing"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-brand-accent/70">
                      <BedDouble className="h-3 w-3" />
                      <span>
                        {scope === "rooms" && selectedRoom
                          ? selectedRoom.name
                          : "Whole listing"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[10px] border border-white/10 bg-black/20 p-3 backdrop-blur">
                  <div className="text-center">
                    <div className="text-[9.5px] uppercase tracking-wider text-brand-accent/70">
                      Check-in
                    </div>
                    <div className="num mt-1 font-display text-[16px] font-bold leading-none">
                      {checkIn ? prettyDate(checkIn, true) : "—"}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="num rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                      {nights} {nights === 1 ? "night" : "nights"}
                    </span>
                    <ArrowRight className="mt-1 h-3 w-3 text-brand-primary" />
                  </div>
                  <div className="text-center">
                    <div className="text-[9.5px] uppercase tracking-wider text-brand-accent/70">
                      Check-out
                    </div>
                    <div className="num mt-1 font-display text-[16px] font-bold leading-none">
                      {checkOut ? prettyDate(checkOut, true) : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11.5px]">
                  <Users className="h-3.5 w-3.5 text-brand-primary" />
                  <span className="text-white">
                    {adults} adult{adults === 1 ? "" : "s"}
                    {children > 0
                      ? ` · ${children} child${children === 1 ? "" : "ren"}`
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="max-h-[440px] overflow-y-auto">
              <ul className="space-y-2 px-5 pt-5 text-[12.5px]">
                <li className="flex items-center justify-between">
                  <span className="text-brand-mute">
                    {formatMoney(nightly, currency)} × {nights || 0}{" "}
                    {nights === 1 ? "night" : "nights"}
                  </span>
                  <span className="num font-medium text-brand-ink">
                    {formatMoney(grossBase, currency)}
                  </span>
                </li>
                {discountVal > 0 && (
                  <li className="flex items-center justify-between">
                    <span className="text-brand-mute">Discount</span>
                    <span className="num font-medium text-brand-primary">
                      − {formatMoney(discountVal, currency)}
                    </span>
                  </li>
                )}
                <li className="flex items-center justify-between">
                  <span className="text-brand-mute">Cleaning fee</span>
                  <span className="num font-medium text-brand-ink">
                    {formatMoney(cleaning, currency)}
                  </span>
                </li>
              </ul>

              {addonLines.length > 0 && (
                <div className="mx-5 mt-4 rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-mute">
                    <span>Add-ons</span>
                    <span className="font-medium normal-case tracking-normal">
                      {addonLines.length} selected
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[11.5px]">
                    {addonLines.map((a) => (
                      <li
                        key={a.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-brand-ink">
                          {a.label}
                          {a.quantity > 1 && (
                            <span className="text-brand-mute">
                              {" "}
                              × {a.quantity}
                            </span>
                          )}
                        </span>
                        <span className="num font-medium text-brand-ink">
                          {formatMoney(a.subtotal, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between border-t border-brand-line pt-2">
                    <span className="text-[11px] font-semibold text-brand-ink">
                      Add-ons subtotal
                    </span>
                    <span className="num font-display text-[12.5px] font-bold text-brand-secondary">
                      + {formatMoney(addonsTotal, currency)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mx-5 my-4 h-px bg-brand-line" />

              <div className="px-5 pb-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
                      Guest pays
                    </div>
                    <div className="num mt-1 font-display text-[26px] font-bold leading-none text-brand-ink">
                      {formatMoney(total, currency)}
                    </div>
                  </div>
                  {nights > 0 && (
                    <div className="text-right">
                      <div className="text-[10.5px] text-brand-mute">
                        avg / night
                      </div>
                      <div className="num font-display text-[14px] font-bold text-brand-ink">
                        {formatMoney(total / nights, currency)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 px-5 pb-5">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-mute">
                  What happens next
                </div>
                <ol className="space-y-2 text-[11.5px]">
                  {nextSteps(paymentState).map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                          i === 0
                            ? "bg-brand-primary text-white"
                            : "bg-brand-line text-brand-mute"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={
                          i === 0 ? "text-brand-ink" : "text-brand-mute"
                        }
                      >
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Sticky CTA */}
            <div className="space-y-2 border-t border-brand-line bg-white p-4">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-4 py-3 text-[14px] font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary disabled:opacity-60"
              >
                {pending ? "Creating…" : ctaLabel}
                {!pending && <ArrowRight className="h-4 w-4" />}
              </button>
              <div className="flex items-center justify-center gap-1.5 pt-1 text-[10.5px] text-brand-mute">
                <ShieldCheck className="h-3 w-3" />
                {paymentState === "send_paystack_link"
                  ? "No charge until the guest pays"
                  : "Calendar blocks the moment you create this booking"}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Month grid ──────────────────────────────────────────────────────────
function MonthGrid({
  year,
  month,
  checkIn,
  checkOut,
  todayStr,
  isBlocked,
  onPick,
  showPrev,
  showNext,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  checkIn: string;
  checkOut: string;
  todayStr: string;
  isBlocked: (d: string) => boolean;
  onPick: (d: string) => void;
  showPrev?: boolean;
  showNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        {showPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="flex h-7 w-7 items-center justify-center rounded-md text-brand-mute hover:bg-brand-accent/40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="w-7" />
        )}
        <div className="font-display text-[14px] font-bold text-brand-ink">
          {MONTHS[month]} {year}
        </div>
        {showNext ? (
          <button
            type="button"
            onClick={onNext}
            className="flex h-7 w-7 items-center justify-center rounded-md text-brand-mute hover:bg-brand-accent/40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="w-7" />
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} className="aspect-square" />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const past = dateStr < todayStr;
          const blocked = isBlocked(dateStr);
          const isStart = dateStr === checkIn;
          const isEnd = dateStr === checkOut;
          const inRange =
            checkIn && checkOut && dateStr > checkIn && dateStr < checkOut;
          const isToday = dateStr === todayStr;

          let cls =
            "flex aspect-square items-center justify-center rounded-[8px] text-[12.5px] transition";
          if (past) cls += " cursor-default text-brand-line";
          else if (blocked)
            cls +=
              " cursor-not-allowed text-brand-mute/60 line-through [background:repeating-linear-gradient(45deg,#F0FDF4,#F0FDF4_4px,#DCEAE0_4px,#DCEAE0_5px)]";
          else cls += " cursor-pointer hover:bg-brand-line";
          if (isStart || isEnd)
            cls += " !bg-brand-primary font-bold text-white";
          else if (inRange) cls += " !bg-brand-accent text-brand-secondary";
          else if (isToday && !past) cls += " font-bold text-brand-secondary";

          return (
            <button
              key={i}
              type="button"
              disabled={past || blocked}
              onClick={() => onPick(dateStr)}
              className={cls}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shiftMonth(
  cur: { year: number; month: number },
  delta: number,
  set: (v: { year: number; month: number }) => void,
) {
  const m = cur.month + delta;
  const year = cur.year + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const now = new Date();
  // Don't page before the current month.
  if (
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth())
  )
    return;
  set({ year, month });
}

// ── Small presentational helpers ────────────────────────────────────────
function SectionCard({
  n,
  done,
  title,
  subtitle,
  children,
}: {
  n: number;
  done?: boolean;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill font-display text-[11px] font-bold ${
            done
              ? "bg-brand-primary text-white"
              : "bg-brand-secondary text-brand-accent"
          }`}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-bold text-brand-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-brand-mute">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Dot({ active, className }: { active?: boolean; className?: string }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] items-center justify-center rounded-pill border transition ${
        active
          ? "border-brand-primary bg-brand-primary text-white"
          : "border-brand-line bg-white text-transparent"
      } ${className ?? ""}`}
    >
      <Check className="h-3 w-3" />
    </span>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "accent";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10.5px] font-semibold ${
        tone === "accent"
          ? "bg-brand-accent text-brand-secondary"
          : "bg-brand-light text-brand-mute"
      }`}
    >
      {children}
    </span>
  );
}

function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative h-[18px] w-8 shrink-0 rounded-pill transition-colors ${
        on ? "bg-brand-primary" : "bg-brand-line"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[14px]" : ""
        }`}
      />
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-brand-line bg-white">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex h-8 w-7 items-center justify-center text-brand-mute hover:bg-brand-accent/40 disabled:text-brand-line"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="num min-w-[26px] text-center text-[13px] font-semibold text-brand-ink">
        {value}
      </span>
      <button
        type="button"
        disabled={max != null && value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-8 w-7 items-center justify-center text-brand-mute hover:bg-brand-accent/40 disabled:text-brand-line"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CounterRow({
  label,
  hint,
  value,
  min,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[10px] border border-brand-line p-3">
      <div>
        <div className="text-[12.5px] font-semibold text-brand-ink">
          {label}
        </div>
        <div className="text-[10.5px] text-brand-mute">{hint}</div>
      </div>
      <Stepper value={value} min={min} max={null} onChange={onChange} />
    </div>
  );
}

function PayCard({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-[12px] border p-4 text-left transition ${
        active
          ? "border-brand-primary bg-brand-accent/40 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
          : "border-brand-line hover:bg-brand-accent/20"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-brand-secondary">{icon}</span>
        <Dot active={active} />
      </div>
      <div className="mt-3 text-[13px] font-semibold text-brand-ink">
        {title}
      </div>
      <div className="mt-0.5 text-[11px] text-brand-mute">{sub}</div>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
      {children}
    </label>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1.5 flex h-[38px] items-center gap-2 rounded-[10px] border border-brand-line bg-white px-3 text-[13.5px] text-brand-ink">
        <CalendarIcon className="h-4 w-4 text-brand-mute" />
        {value}
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  hint,
  symbol,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  symbol: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-brand-mute">
          {symbol}
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD} num pl-7`}
        />
      </div>
      {hint && <div className="mt-1 text-[10.5px] text-brand-mute">{hint}</div>}
    </div>
  );
}

function QuickChip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-ink hover:bg-brand-accent/40"
    >
      {children}
    </button>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────────
function nextSteps(state: PayState): string[] {
  if (state === "send_paystack_link")
    return [
      "Guest gets a payment link by email",
      "Calendar blocks once they pay",
      "Booking stays pending until paid",
    ];
  if (state === "unpaid")
    return [
      "Booking is confirmed and the calendar is blocked",
      "Collect payment on arrival",
      "Mark as paid from the booking page after",
    ];
  return [
    "Booking is confirmed immediately",
    "Calendar is blocked for these dates",
    "An invoice is attached automatically",
  ];
}

function symbolFor(currency: string): string {
  return currency === "ZAR" ? "R" : currency;
}

function prettyDate(s: string, short = false): string {
  const d = parseYmd(s);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const mo = MONTHS[d.getMonth()].slice(0, 3);
  if (short) return `${wd} ${pad(d.getDate())}`;
  return `${wd} ${pad(d.getDate())} ${mo} ${d.getFullYear()}`;
}

function prettyMonth(s: string): string {
  const d = parseYmd(s);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "G";
}
