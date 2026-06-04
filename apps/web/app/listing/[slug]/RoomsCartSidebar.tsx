"use client";

import { Home, Minus, Plus, Star, Trash2, Users, Zap } from "lucide-react";
import { useMemo } from "react";

import { formatMoney } from "@/lib/format";
import { priceStay, type PricingUnit, type SeasonalRule } from "@/lib/pricing";

import { useRoomsCart } from "./RoomsCartProvider";
import {
  roomFromNightly,
  roomNightlyBase,
  type PublicRoom,
} from "./roomDisplay";

/** Map a public room + its guest count to a pricing-engine unit. */
function toPricingUnit(r: PublicRoom, guests: number): PricingUnit {
  return {
    roomId: r.id,
    pricing_mode: r.pricing_mode,
    base_price: r.base_price,
    price_per_person: r.price_per_person,
    base_occupancy: r.base_occupancy,
    extra_guest_price: r.extra_guest_price,
    weekend_price: r.weekend_price ?? null,
    cleaning_fee: r.cleaning_fee,
    guests,
  };
}

const EMPTY_DISCOUNT = {
  wholeSaving: 0,
  losSaving: 0,
  losKind: null as "weekly" | "monthly" | null,
  losPct: 0,
  discountTotal: 0,
  total: 0,
};

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(f) || !Number.isFinite(t)) return 0;
  const n = Math.round((t - f) / (1000 * 60 * 60 * 24));
  return n > 0 ? n : 0;
}

export function RoomsCartSidebar({
  slug,
  rooms,
  currency,
  maxGuestsCap,
  instantBooking,
  rating,
  reviewCount,
  basePrice,
  weekendPrice,
  cleaningFee,
  minNights,
  seasonalRules,
  wholeDiscountPct,
  weeklyDiscountPct,
  monthlyDiscountPct,
}: {
  slug: string;
  rooms: PublicRoom[];
  currency: string;
  maxGuestsCap: number;
  instantBooking: boolean;
  rating: number | null;
  reviewCount: number | null;
  // Used when mode === "flexible" + flexibleTab === "whole".
  basePrice: number | null;
  weekendPrice: number | null;
  cleaningFee: number | null;
  minNights: number | null;
  // Active seasonal rules — so the cart estimate matches the checkout total.
  seasonalRules: SeasonalRule[];
  // Combo + length-of-stay discounts (applied server-side; mirrored here).
  wholeDiscountPct: number | null;
  weeklyDiscountPct: number | null;
  monthlyDiscountPct: number | null;
}) {
  const {
    mode,
    flexibleTab,
    setFlexibleTab,
    selected,
    toggle,
    roomGuests,
    setRoomGuests,
    checkIn,
    checkOut,
    setCheckIn,
    setCheckOut,
    guests,
    setGuests,
  } = useRoomsCart();

  const nights = nightsBetween(checkIn, checkOut);
  const isRoomsTab = mode === "rooms_only" || flexibleTab === "rooms";

  const selectedRooms = useMemo(
    () => rooms.filter((r) => selected.has(r.id)),
    [rooms, selected],
  );

  const guestsFor = (roomId: string) => Math.max(1, roomGuests[roomId] ?? 1);
  const totalRoomGuests = selectedRooms.reduce(
    (acc, r) => acc + guestsFor(r.id),
    0,
  );

  const minRoomsPrice = useMemo(() => {
    const prices = rooms.map((r) => roomFromNightly(r)).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, [rooms]);

  // All passed rooms are active → booking every one is the whole-place combo.
  const isWholeCombo =
    selectedRooms.length > 1 && selectedRooms.length === rooms.length;

  // Rooms tab — priced through the canonical engine (seasonal + weekend +
  // occupancy + discounts), so the cart estimate equals the checkout total.
  const roomsBreakdown =
    nights > 0 && selectedRooms.length > 0
      ? priceStay({
          checkIn,
          checkOut,
          units: selectedRooms.map((r) => toPricingUnit(r, guestsFor(r.id))),
          seasonalRules,
          currency,
          totalGuests: totalRoomGuests,
          listingMinNights: minNights ?? 1,
          isWholeCombo,
          wholePct: wholeDiscountPct,
          weeklyPct: weeklyDiscountPct,
          monthlyPct: monthlyDiscountPct,
        })
      : null;
  const roomsCalc = {
    base: roomsBreakdown?.baseSubtotal ?? 0,
    cleaning: roomsBreakdown?.cleaningTotal ?? 0,
    total: roomsBreakdown?.total ?? 0,
  };
  const roomsDiscount = roomsBreakdown?.discount ?? EMPTY_DISCOUNT;

  // Whole tab — the listing base as a single unit; combo discount doesn't stack.
  const wholeBreakdown =
    nights > 0 && basePrice != null
      ? priceStay({
          checkIn,
          checkOut,
          units: [
            {
              roomId: null,
              pricing_mode: "per_room",
              base_price: basePrice,
              price_per_person: null,
              base_occupancy: null,
              extra_guest_price: null,
              weekend_price: weekendPrice,
              cleaning_fee: cleaningFee ?? 0,
              guests,
            },
          ],
          seasonalRules,
          currency,
          totalGuests: guests,
          listingMinNights: minNights ?? 1,
          isWholeCombo: false,
          wholePct: null,
          weeklyPct: weeklyDiscountPct,
          monthlyPct: monthlyDiscountPct,
        })
      : null;
  const wholeCalc = {
    base: wholeBreakdown?.baseSubtotal ?? 0,
    cleaning: wholeBreakdown?.cleaningTotal ?? 0,
    total: wholeBreakdown?.total ?? 0,
  };
  const wholeDiscount = wholeBreakdown?.discount ?? EMPTY_DISCOUNT;

  const losLabel = (kind: "weekly" | "monthly" | null): string =>
    kind === "monthly" ? "Monthly discount" : "Weekly discount";

  // Reserve href construction.
  const wholeReady =
    nights > 0 &&
    guests >= 1 &&
    guests <= maxGuestsCap &&
    basePrice != null &&
    basePrice > 0;
  const roomsReady = nights > 0 && selectedRooms.length > 0;
  const canReserve = isRoomsTab ? roomsReady : wholeReady;

  const reserveHref = useMemo(() => {
    const params = new URLSearchParams();
    if (checkIn) params.set("from", checkIn);
    if (checkOut) params.set("to", checkOut);
    if (isRoomsTab && selectedRooms.length > 0) {
      params.set("room_ids", selectedRooms.map((r) => r.id).join(","));
      // Per-room guests "roomId:n,roomId:n" — drives per-person / extra pricing.
      params.set(
        "room_guests",
        selectedRooms.map((r) => `${r.id}:${guestsFor(r.id)}`).join(","),
      );
      params.set("guests", String(totalRoomGuests));
    } else {
      params.set("guests", String(guests));
    }
    return `/listing/${encodeURIComponent(slug)}/book?${params.toString()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    checkIn,
    checkOut,
    guests,
    isRoomsTab,
    selectedRooms,
    roomGuests,
    totalRoomGuests,
    slug,
  ]);

  return (
    <div className="sticky top-20 rounded-card border border-brand-line bg-white p-5 shadow-card">
      {/* Header price */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          {isRoomsTab ? (
            minRoomsPrice != null ? (
              <>
                <span className="text-[11px] uppercase tracking-wider text-brand-mute">
                  From
                </span>
                <div>
                  <span className="font-display text-2xl font-bold text-brand-ink">
                    {formatMoney(minRoomsPrice, currency)}
                  </span>
                  <span className="ml-1 text-sm text-brand-mute">/ night</span>
                </div>
              </>
            ) : (
              <span className="text-sm text-brand-mute">No rooms yet</span>
            )
          ) : basePrice != null ? (
            <>
              <span className="font-display text-2xl font-bold text-brand-ink">
                {formatMoney(basePrice, currency)}
              </span>
              <span className="ml-1 text-sm text-brand-mute">/ night</span>
            </>
          ) : (
            <span className="text-sm text-brand-mute">Price on request</span>
          )}
        </div>
        {rating != null && reviewCount != null && reviewCount > 0 ? (
          <div className="flex items-center gap-1 text-xs">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-brand-ink">
              {rating.toFixed(1)}
            </span>
            <span className="text-brand-mute">({reviewCount})</span>
          </div>
        ) : null}
      </div>

      {instantBooking ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
          <Zap className="h-3 w-3" /> Instant book
        </div>
      ) : null}

      {/* Flexible mode tab toggle */}
      {mode === "flexible" ? (
        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-pill border border-brand-line bg-brand-light/40 p-0.5">
          <button
            type="button"
            onClick={() => setFlexibleTab("whole")}
            className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
              flexibleTab === "whole"
                ? "bg-brand-primary text-white"
                : "text-brand-dark hover:bg-white/60"
            }`}
          >
            Whole place
          </button>
          <button
            type="button"
            onClick={() => setFlexibleTab("rooms")}
            className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
              flexibleTab === "rooms"
                ? "bg-brand-primary text-white"
                : "text-brand-dark hover:bg-white/60"
            }`}
          >
            Specific rooms
          </button>
        </div>
      ) : null}

      {/* Dates + guests */}
      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-card border border-brand-line">
        <label className="flex cursor-pointer flex-col gap-1 border-r border-brand-line px-3 py-2.5 hover:bg-brand-light/60">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Check in
          </span>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="bg-transparent text-sm font-medium text-brand-dark outline-none"
          />
        </label>
        <label className="flex cursor-pointer flex-col gap-1 px-3 py-2.5 hover:bg-brand-light/60">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Check out
          </span>
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="bg-transparent text-sm font-medium text-brand-dark outline-none"
          />
        </label>
        {!isRoomsTab ? (
          <label className="col-span-2 flex cursor-pointer items-center gap-2 border-t border-brand-line px-3 py-2.5 hover:bg-brand-light/60">
            <Users className="h-4 w-4 text-brand-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Guests
            </span>
            <select
              value={guests}
              onChange={(e) => setGuests(parseInt(e.target.value, 10))}
              className="ml-auto bg-transparent text-sm font-medium text-brand-dark outline-none"
            >
              {Array.from(
                { length: Math.max(1, maxGuestsCap) },
                (_, i) => i + 1,
              ).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="col-span-2 flex items-center gap-2 border-t border-brand-line px-3 py-2.5 text-[11px] text-brand-mute">
            <Users className="h-4 w-4 text-brand-primary" />
            Set guests per room below · {totalRoomGuests} total
          </div>
        )}
      </div>

      {/* Cart / summary */}
      {isRoomsTab ? (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Your rooms
          </div>
          {selectedRooms.length === 0 ? (
            <div className="mt-2 rounded border border-dashed border-brand-line bg-brand-light/40 px-3 py-4 text-center text-xs text-brand-mute">
              Add at least one room from the list.
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {selectedRooms.map((r) => {
                const g = guestsFor(r.id);
                const nightly = roomNightlyBase(r, g);
                return (
                  <li
                    key={r.id}
                    className="rounded border border-brand-line bg-brand-light/40 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-brand-ink">
                          {r.name}
                        </div>
                        <div className="text-[11px] text-brand-mute">
                          {formatMoney(nightly, currency)}
                          {nights > 0 ? ` × ${nights}` : ""}
                          {r.cleaning_fee > 0
                            ? ` + ${formatMoney(r.cleaning_fee, currency)} cleaning`
                            : ""}
                          {r.pricing_mode === "per_person"
                            ? ` · ${formatMoney(r.price_per_person ?? 0, currency)}/person`
                            : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        className="rounded p-1 text-brand-mute hover:bg-white hover:text-status-cancelled"
                        aria-label={`Remove ${r.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Per-room guests — capped at the room's bed capacity. */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                        Guests (max {r.max_guests})
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setRoomGuests(r.id, Math.max(1, g - 1))
                          }
                          disabled={g <= 1}
                          className="flex h-7 w-7 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-accent disabled:opacity-40"
                          aria-label="Fewer guests"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-brand-ink">
                          {g}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRoomGuests(r.id, Math.min(r.max_guests, g + 1))
                          }
                          disabled={g >= r.max_guests}
                          className="flex h-7 w-7 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-accent disabled:opacity-40"
                          aria-label="More guests"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* CTA */}
      <a
        href={canReserve ? reserveHref : undefined}
        aria-disabled={!canReserve}
        onClick={(e) => {
          if (!canReserve) e.preventDefault();
        }}
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded px-4 py-3 text-sm font-medium transition-colors ${
          canReserve
            ? "bg-brand-primary text-white hover:bg-brand-secondary"
            : "cursor-not-allowed bg-brand-line text-brand-mute"
        }`}
      >
        {isRoomsTab
          ? selectedRooms.length === 0
            ? "Add a room"
            : nights === 0
              ? "Pick your dates"
              : `Reserve ${selectedRooms.length} ${
                  selectedRooms.length === 1 ? "room" : "rooms"
                } · ${formatMoney(roomsDiscount.total, currency)}`
          : nights > 0 && basePrice != null
            ? `Reserve · ${formatMoney(wholeDiscount.total, currency)}`
            : "Pick your dates"}
      </a>

      <div className="mt-2 text-center text-[10px] text-brand-mute">
        You won&rsquo;t be charged yet.
      </div>

      {/* Price breakdown */}
      {nights > 0 ? (
        isRoomsTab && selectedRooms.length > 0 ? (
          <dl className="mt-4 space-y-2 border-t border-brand-line pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-brand-mute">Rooms × {nights} nights</dt>
              <dd className="font-medium text-brand-dark">
                {formatMoney(roomsCalc.base, currency)}
              </dd>
            </div>
            {roomsDiscount.wholeSaving > 0 ? (
              <div className="flex items-center justify-between text-brand-primary">
                <dt className="inline-flex items-center gap-1.5">
                  <Home className="h-3.5 w-3.5" /> Whole place ·{" "}
                  {wholeDiscountPct}%
                </dt>
                <dd className="font-medium">
                  − {formatMoney(roomsDiscount.wholeSaving, currency)}
                </dd>
              </div>
            ) : null}
            {roomsDiscount.losSaving > 0 ? (
              <div className="flex items-center justify-between text-brand-primary">
                <dt>
                  {losLabel(roomsDiscount.losKind)} · {roomsDiscount.losPct}%
                </dt>
                <dd className="font-medium">
                  − {formatMoney(roomsDiscount.losSaving, currency)}
                </dd>
              </div>
            ) : null}
            {roomsCalc.cleaning > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">Cleaning fees</dt>
                <dd className="font-medium text-brand-dark">
                  {formatMoney(roomsCalc.cleaning, currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-brand-line pt-2">
              <dt className="font-display font-semibold text-brand-ink">
                Total
              </dt>
              <dd className="font-display font-bold text-brand-ink">
                {formatMoney(roomsDiscount.total, currency)}
              </dd>
            </div>
          </dl>
        ) : !isRoomsTab && basePrice != null ? (
          <dl className="mt-4 space-y-2 border-t border-brand-line pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-brand-mute">
                {formatMoney(basePrice, currency)} × {nights}{" "}
                {nights === 1 ? "night" : "nights"}
              </dt>
              <dd className="font-medium text-brand-dark">
                {formatMoney(wholeCalc.base, currency)}
              </dd>
            </div>
            {wholeDiscount.losSaving > 0 ? (
              <div className="flex items-center justify-between text-brand-primary">
                <dt>
                  {losLabel(wholeDiscount.losKind)} · {wholeDiscount.losPct}%
                </dt>
                <dd className="font-medium">
                  − {formatMoney(wholeDiscount.losSaving, currency)}
                </dd>
              </div>
            ) : null}
            {wholeCalc.cleaning > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">Cleaning fee</dt>
                <dd className="font-medium text-brand-dark">
                  {formatMoney(wholeCalc.cleaning, currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-brand-line pt-2">
              <dt className="font-display font-semibold text-brand-ink">
                Total
              </dt>
              <dd className="font-display font-bold text-brand-ink">
                {formatMoney(wholeDiscount.total, currency)}
              </dd>
            </div>
          </dl>
        ) : null
      ) : null}
    </div>
  );
}
