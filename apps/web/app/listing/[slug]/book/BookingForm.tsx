"use client";

import {
  BedDouble,
  Building2,
  Check,
  CreditCard,
  Home,
  Lock,
  Mail,
  PackagePlus,
  ShieldCheck,
  Star,
  User as UserIcon,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";

import {
  PRICING_LABEL,
  computeAddonSubtotal,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import {
  roomFromNightly,
  roomNightlyBase,
  type RoomPricingMode,
} from "../roomDisplay";
import {
  createBookingAction,
  createCheckoutGuestAccountAction,
} from "./actions";

export type RoomOption = {
  id: string;
  name: string;
  bedsLabel: string;
  photoUrl: string | null;
  features: string[];
  maxGuests: number;
  cleaningFee: number;
  pricingMode: RoomPricingMode;
  basePrice: number;
  pricePerPerson: number | null;
  baseOccupancy: number | null;
  extraGuestPrice: number | null;
};

export type AvailableAddon = {
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
};

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const CANCELLATION_BLURB: Record<"flexible" | "moderate" | "strict", string> = {
  flexible: "Full refund up to 24 hours before check-in.",
  moderate: "Full refund up to 5 days before check-in.",
  strict: "50% refund up to 7 days before. No refund after.",
};

const STEPS = ["Review trip", "Payment", "Confirmation"];

/** Visual progress indicator — checkout is at "Review", then Paystack, then success. */
function Stepper() {
  const current = 0;
  return (
    <div className="hide-sb flex items-center gap-2.5 overflow-x-auto">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2.5">
            <div className="flex shrink-0 items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-pill text-xs font-semibold ${
                  done
                    ? "bg-brand-primary text-white"
                    : active
                      ? "border-2 border-brand-primary bg-white text-brand-primary"
                      : "border border-brand-line bg-white text-brand-mute"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <div
                className={`text-xs font-medium ${
                  done
                    ? "text-brand-ink"
                    : active
                      ? "text-brand-primary"
                      : "text-brand-mute"
                }`}
              >
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 ? (
              <div className="h-px w-6 min-w-6 bg-brand-line md:w-10" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function BookingForm({
  listingId,
  listingSlug,
  listingName,
  listingTypeLabel,
  listingCity,
  listingProvince,
  coverImageUrl,
  ratingValue,
  reviewCount,
  basePrice,
  cleaningFee,
  currency,
  cancellationPolicy,
  instantBooking,
  bookingMode,
  checkIn,
  checkOut,
  nights,
  wholeGuests,
  maxGuestsWhole,
  guestEmail,
  isAuthenticated,
  guestName,
  guestPhone,
  allRooms,
  initialSelectedRoomIds,
  initialRoomGuests,
  availableAddons,
  hasEftBanking,
}: {
  listingId: string;
  listingSlug: string;
  listingName: string;
  listingTypeLabel: string;
  listingCity: string | null;
  listingProvince: string | null;
  coverImageUrl: string | null;
  ratingValue: number | null;
  reviewCount: number | null;
  basePrice: number;
  cleaningFee: number;
  currency: string;
  cancellationPolicy: "flexible" | "moderate" | "strict";
  instantBooking: boolean;
  bookingMode: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  wholeGuests: number;
  maxGuestsWhole: number;
  guestEmail: string;
  isAuthenticated: boolean;
  guestName: string;
  guestPhone: string;
  allRooms: RoomOption[];
  initialSelectedRoomIds: string[];
  initialRoomGuests: Record<string, number>;
  availableAddons: AvailableAddon[];
  hasEftBanking: boolean;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [loggingOut, startLogout] = useTransition();

  // ── Room selection state ──────────────────────────────────────
  const roomsMode = allRooms.length > 0 && bookingMode !== "whole_listing";
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(
    () => initialSelectedRoomIds,
  );
  // Flexible listings can flip to "book the whole place".
  const [wholeListing, setWholeListing] = useState(false);
  // Whole-listing guest count (used when not in rooms mode, or flexible-whole).
  const [guestCount, setGuestCount] = useState(wholeGuests);

  // ── Contact / account state ───────────────────────────────────
  const [contact, setContact] = useState({
    fullName: guestName,
    email: guestEmail,
    phone: guestPhone,
    password: "",
    message: "",
  });

  // ── Payment method state ──────────────────────────────────────
  const [method, setMethod] = useState<"paystack" | "eft">("paystack");

  const [policyAck, setPolicyAck] = useState(false);

  // Pre-select required addons at their min_quantity.
  const [addonQty, setAddonQty] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const a of availableAddons) {
      if (a.isRequired) m.set(a.id, Math.max(a.minQuantity, 1));
    }
    return m;
  });

  function toggleAddon(addonId: string) {
    const a = availableAddons.find((x) => x.id === addonId);
    if (!a || a.isRequired) return;
    setAddonQty((prev) => {
      const next = new Map(prev);
      if (next.has(addonId)) next.delete(addonId);
      else next.set(addonId, Math.max(a.minQuantity, 1));
      return next;
    });
  }

  function toggleRoom(roomId: string) {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId],
    );
  }

  // Guests per room (defaults from initialRoomGuests / maxGuests).
  const guestsForRoom = (r: RoomOption) =>
    initialRoomGuests[r.id] ?? r.maxGuests;

  // Whole-listing is active when not in rooms mode, or flexible-whole is on.
  const isWhole = !roomsMode || wholeListing;

  const selectedRooms = useMemo(
    () => allRooms.filter((r) => selectedRoomIds.includes(r.id)),
    [allRooms, selectedRoomIds],
  );

  // ── Live pricing ──────────────────────────────────────────────
  const toPricing = (r: RoomOption) => ({
    pricing_mode: r.pricingMode,
    base_price: r.basePrice,
    price_per_person: r.pricePerPerson,
    base_occupancy: r.baseOccupancy,
    extra_guest_price: r.extraGuestPrice,
  });
  const roomNightly = (r: RoomOption) =>
    roomNightlyBase(toPricing(r), guestsForRoom(r));

  const subtotal = isWhole
    ? basePrice * nights
    : selectedRooms.reduce((acc, r) => acc + roomNightly(r) * nights, 0);
  const cleaningTotal = isWhole
    ? cleaningFee
    : selectedRooms.reduce((acc, r) => acc + r.cleaningFee, 0);
  const effectiveGuests = isWhole
    ? guestCount
    : selectedRooms.reduce((acc, r) => acc + guestsForRoom(r), 0);

  // scope for submit.
  const scope: "whole_listing" | "rooms" =
    roomsMode && !wholeListing && selectedRooms.length > 0
      ? "rooms"
      : "whole_listing";

  const addonsTotal = useMemo(() => {
    let sum = 0;
    for (const [id, qty] of addonQty.entries()) {
      const a = availableAddons.find((x) => x.id === id);
      if (!a || qty <= 0) continue;
      sum += computeAddonSubtotal(
        a.pricingModel,
        a.unitPrice,
        qty,
        nights,
        effectiveGuests,
      );
    }
    return sum;
  }, [addonQty, availableAddons, nights, effectiveGuests]);

  const selectedAddonLines = useMemo(() => {
    const lines: Array<{ id: string; name: string; subtotal: number }> = [];
    for (const [id, qty] of addonQty.entries()) {
      const a = availableAddons.find((x) => x.id === id);
      if (!a || qty <= 0) continue;
      lines.push({
        id,
        name: a.name,
        subtotal: computeAddonSubtotal(
          a.pricingModel,
          a.unitPrice,
          qty,
          nights,
          effectiveGuests,
        ),
      });
    }
    return lines;
  }, [addonQty, availableAddons, nights, effectiveGuests]);

  const total = subtotal + cleaningTotal + addonsTotal;

  // rooms_only listings require at least one room.
  const needsRoom = roomsMode && !wholeListing && selectedRooms.length === 0;
  const reserveDisabled = !policyAck || isPending || loggingOut || needsRoom;

  const locationLine = [listingCity, listingProvince]
    .filter(Boolean)
    .join(", ");

  async function logOut() {
    startLogout(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.refresh();
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!policyAck) {
      toast.error("Please accept the policies to continue.");
      return;
    }
    if (needsRoom) {
      toast.error("Select at least one room to continue.");
      return;
    }
    if (!isAuthenticated) {
      if (
        contact.fullName.trim().length < 2 ||
        !contact.email.includes("@") ||
        contact.password.length < 8
      ) {
        toast.error("Add your name, email and a password (8+ characters).");
        return;
      }
    }

    start(async () => {
      // Anonymous visitors get a guest account created + signed in first.
      if (!isAuthenticated) {
        const acc = await createCheckoutGuestAccountAction({
          full_name: contact.fullName.trim(),
          email: contact.email.trim(),
          password: contact.password,
        });
        if (!acc.ok) {
          toast.error(acc.error);
          return;
        }
      }

      const guestNameOut = contact.fullName.trim() || undefined;
      const guestEmailOut = isAuthenticated ? guestEmail : contact.email.trim();
      const guestPhoneOut = contact.phone.trim() || undefined;
      const messageOut = contact.message.trim() || undefined;

      const result = await createBookingAction({
        listing_id: listingId,
        scope,
        room_ids:
          scope === "rooms" ? selectedRooms.map((r) => r.id) : undefined,
        room_guests:
          scope === "rooms"
            ? selectedRooms.map((r) => ({
                room_id: r.id,
                guests: guestsForRoom(r),
              }))
            : undefined,
        check_in: checkIn,
        check_out: checkOut,
        guests: effectiveGuests,
        payment_method: method,
        policy_acknowledged: true,
        selected_addons: Array.from(addonQty.entries())
          .filter(([, q]) => q > 0)
          .map(([addon_id, quantity]) => ({ addon_id, quantity })),
        guest_name: guestNameOut,
        guest_email: guestEmailOut,
        guest_phone: guestPhoneOut,
        special_requests: messageOut,
      });
      // Success is a server-side redirect; we only land here on failure.
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  const reserveLabel = isPending
    ? !isAuthenticated
      ? "Creating account…"
      : method === "eft"
        ? "Reserving…"
        : "Redirecting to Paystack…"
    : method === "eft"
      ? "Reserve — pay by EFT"
      : isAuthenticated
        ? "Reserve and pay"
        : "Create account & reserve";

  const cardLabel = "rounded-card border border-brand-line bg-white";
  const sectionHead =
    "px-5 py-4 border-b border-brand-line flex items-center justify-between gap-3";

  const paymentMethods = [
    {
      id: "paystack" as const,
      label: "Pay with card",
      sub: "Visa, Mastercard & instant EFT · secured by Paystack",
      Icon: CreditCard,
    },
    ...(hasEftBanking
      ? [
          {
            id: "eft" as const,
            label: "EFT bank transfer",
            sub: "Pay by transfer · the host verifies it",
            Icon: Building2,
          },
        ]
      : []),
  ];

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-8"
    >
      {/* ── Left column ─────────────────────────────────────────── */}
      <div className="space-y-7 pb-24 lg:pb-0">
        <Stepper />

        <header>
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
            You&rsquo;re booking
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-[28px]">
            {listingName}
          </h1>
          <p className="mt-1.5 text-sm text-brand-mute">
            {locationLine
              ? `${listingTypeLabel} · ${locationLine}`
              : listingTypeLabel}{" "}
            — confirm your details, then continue to secure payment.
          </p>
        </header>

        {/* Rooms / whole-place selection */}
        {roomsMode ? (
          <section className={cardLabel}>
            <div className={sectionHead}>
              <div className="min-w-0">
                <div className="font-display font-semibold text-brand-ink">
                  Your rooms
                </div>
                <div className="mt-0.5 text-xs text-brand-mute">
                  {wholeListing
                    ? "Booking the whole place"
                    : `${selectedRooms.length} ${
                        selectedRooms.length === 1 ? "room" : "rooms"
                      } selected`}
                </div>
              </div>
              {bookingMode === "flexible" ? (
                <button
                  type="button"
                  onClick={() => setWholeListing((v) => !v)}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold transition ${
                    wholeListing
                      ? "bg-brand-primary text-white"
                      : "border border-brand-line bg-white text-brand-ink hover:border-brand-primary/50"
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  Book the whole place
                </button>
              ) : null}
            </div>

            {wholeListing ? (
              <div className="flex items-center gap-3 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                  <Home className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-brand-ink">
                    {listingName}
                  </div>
                  <div className="text-xs text-brand-mute">
                    {fmtR(basePrice, currency)} / night
                    {cleaningFee > 0
                      ? ` · ${fmtR(cleaningFee, currency)} cleaning`
                      : ""}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 p-4 sm:p-5">
                {needsRoom ? (
                  <div className="rounded border border-dashed border-status-cancelled/40 bg-status-cancelled/5 px-3 py-2 text-xs font-medium text-status-cancelled">
                    Select at least one room.
                  </div>
                ) : null}
                {allRooms.map((r) => {
                  const selected = selectedRoomIds.includes(r.id);
                  const nightly = roomNightly(r);
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => toggleRoom(r.id)}
                      disabled={isPending}
                      className={`flex w-full items-stretch gap-3 rounded-card border p-3 text-left transition sm:gap-4 sm:p-4 ${
                        selected
                          ? "border-brand-primary bg-brand-accent/30"
                          : "border-brand-line bg-white hover:border-brand-primary/50"
                      }`}
                    >
                      {r.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photoUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-md object-cover sm:h-20 sm:w-20"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary sm:h-20 sm:w-20">
                          <BedDouble className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-display font-semibold text-brand-ink">
                              {r.name}
                            </div>
                            <div className="mt-0.5 text-xs text-brand-mute">
                              {r.bedsLabel ? `${r.bedsLabel} · ` : ""}Sleeps{" "}
                              {r.maxGuests}
                            </div>
                          </div>
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                              selected
                                ? "border-brand-primary bg-brand-primary text-white"
                                : "border-brand-line bg-white"
                            }`}
                          >
                            {selected ? <Check className="h-3 w-3" /> : null}
                          </div>
                        </div>
                        {r.features.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {r.features.map((f) => (
                              <span
                                key={f}
                                className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-baseline justify-between gap-3">
                          <div className="text-xs text-brand-mute">
                            <span className="font-semibold text-brand-ink">
                              {fmtR(roomFromNightly(toPricing(r)), currency)}
                            </span>{" "}
                            / night
                            {r.cleaningFee > 0
                              ? ` · ${fmtR(r.cleaningFee, currency)} cleaning`
                              : ""}
                          </div>
                          {selected ? (
                            <div className="font-mono text-[11px] text-brand-secondary">
                              × {nights} ={" "}
                              <span className="font-semibold">
                                {fmtR(
                                  nightly * nights + r.cleaningFee,
                                  currency,
                                )}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className={cardLabel}>
            <div className={sectionHead}>
              <div className="font-display font-semibold text-brand-ink">
                Whole place
              </div>
              {instantBooking ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
                  <Zap className="h-3 w-3" /> Instant Book
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-brand-ink">{listingName}</div>
                <div className="text-xs text-brand-mute">
                  {fmtR(basePrice, currency)} / night
                  {cleaningFee > 0
                    ? ` · ${fmtR(cleaningFee, currency)} cleaning`
                    : ""}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Your trip */}
        <section className={cardLabel}>
          <div className="border-b border-brand-line px-5 py-4">
            <div className="font-display font-semibold text-brand-ink">
              Your trip
            </div>
            <div className="mt-0.5 text-xs text-brand-mute">
              {nights} {nights === 1 ? "night" : "nights"}
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="rounded-card border border-brand-line p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                Check-in
              </div>
              <div className="mt-1 font-display text-lg font-semibold text-brand-ink">
                {fmtDate(checkIn)}
              </div>
            </div>
            <div className="rounded-card border border-brand-line p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                Check-out
              </div>
              <div className="mt-1 font-display text-lg font-semibold text-brand-ink">
                {fmtDate(checkOut)}
              </div>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="mb-1.5 block text-sm font-medium text-brand-ink">
              Guests
            </div>
            {isWhole ? (
              <div className="inline-flex items-center gap-2 rounded border border-brand-line bg-white px-4 py-3">
                <Users className="h-4 w-4 text-brand-primary" />
                <select
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value, 10))}
                  disabled={isPending}
                  className="bg-transparent text-sm font-medium text-brand-ink outline-none"
                >
                  {Array.from(
                    { length: Math.max(1, maxGuestsWhole) },
                    (_, i) => i + 1,
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded border border-brand-line bg-brand-light/40 px-4 py-3 text-sm font-medium text-brand-ink">
                <Users className="h-4 w-4 text-brand-primary" />
                {effectiveGuests} {effectiveGuests === 1 ? "guest" : "guests"}
                <span className="text-[11px] font-normal text-brand-mute">
                  · set per room
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Add-ons */}
        {availableAddons.length > 0 ? (
          <section className={cardLabel}>
            <div className={sectionHead}>
              <div className="min-w-0">
                <div className="font-display font-semibold text-brand-ink">
                  Make it extra-special
                </div>
                <div className="mt-0.5 text-xs text-brand-mute">
                  Optional add-ons offered by your host.
                  {selectedAddonLines.length > 0 ? (
                    <span className="font-medium text-brand-primary">
                      {" "}
                      · {selectedAddonLines.length} selected
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                Optional
              </div>
            </div>
            <div className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-5">
              {availableAddons.map((a) => {
                const qty = addonQty.get(a.id) ?? 0;
                const checked = qty > 0;
                const lineTotal = checked
                  ? computeAddonSubtotal(
                      a.pricingModel,
                      a.unitPrice,
                      qty,
                      nights,
                      effectiveGuests,
                    )
                  : 0;
                return (
                  <button
                    type="button"
                    key={a.id}
                    disabled={a.isRequired || isPending}
                    onClick={() => toggleAddon(a.id)}
                    className={`flex gap-3 rounded-card border p-3.5 text-left transition ${
                      checked
                        ? "border-brand-primary bg-brand-accent/30"
                        : "border-brand-line bg-white hover:border-brand-primary/50"
                    } ${a.isRequired ? "cursor-default" : ""}`}
                  >
                    {a.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                          checked
                            ? "bg-brand-primary text-white"
                            : "bg-brand-accent text-brand-primary"
                        }`}
                      >
                        <PackagePlus className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold leading-tight text-brand-ink">
                          {a.name}
                        </div>
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                            checked
                              ? "border-brand-primary bg-brand-primary text-white"
                              : "border-brand-line bg-white"
                          }`}
                        >
                          {checked ? <Check className="h-3 w-3" /> : null}
                        </div>
                      </div>
                      {a.description ? (
                        <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-brand-mute">
                          {a.description}
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-baseline justify-between gap-3">
                        <div className="text-xs">
                          <span className="font-semibold text-brand-ink">
                            {fmtR(a.unitPrice, currency)}
                          </span>
                          <span className="text-brand-mute">
                            {" "}
                            · {PRICING_LABEL[a.pricingModel]}
                          </span>
                        </div>
                        {checked && lineTotal > 0 ? (
                          <div className="font-mono text-[11px] text-brand-secondary">
                            = {fmtR(lineTotal, currency)}
                          </div>
                        ) : null}
                      </div>
                      {a.isRequired ? (
                        <span className="mt-1.5 inline-flex rounded-pill bg-brand-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          Required
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Contact details / create account */}
        <section className={cardLabel}>
          <div className="border-b border-brand-line px-5 py-4">
            <div className="font-display font-semibold text-brand-ink">
              {isAuthenticated
                ? "Contact details"
                : "Create your guest account"}
            </div>
            <div className="mt-0.5 text-xs text-brand-mute">
              {isAuthenticated
                ? "Your host uses this to share check-in instructions."
                : "Booking without an account? We’ll set one up so you can manage your trip and message your host."}
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                Full name
              </label>
              <input
                value={contact.fullName}
                onChange={(e) =>
                  setContact((s) => ({ ...s, fullName: e.target.value }))
                }
                placeholder="Amara Okafor"
                autoComplete="name"
                className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                Email
              </label>
              {isAuthenticated ? (
                <div className="flex items-center gap-2 rounded border border-brand-line bg-brand-light/40 px-3.5 py-2.5 text-sm">
                  <UserIcon className="h-4 w-4 shrink-0 text-brand-primary" />
                  <span className="min-w-0 flex-1 truncate font-mono text-brand-ink">
                    {guestEmail}
                  </span>
                </div>
              ) : (
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) =>
                    setContact((s) => ({ ...s, email: e.target.value }))
                  }
                  placeholder="amara@example.com"
                  autoComplete="email"
                  className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                Phone{" "}
                <span className="font-normal text-brand-mute">(optional)</span>
              </label>
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) =>
                  setContact((s) => ({ ...s, phone: e.target.value }))
                }
                placeholder="+27 82 000 0000"
                autoComplete="tel"
                className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
              />
            </div>
            {!isAuthenticated ? (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                  Create a password
                </label>
                <input
                  type="password"
                  value={contact.password}
                  onChange={(e) =>
                    setContact((s) => ({ ...s, password: e.target.value }))
                  }
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                Message to host{" "}
                <span className="font-normal text-brand-mute">(optional)</span>
              </label>
              <textarea
                value={contact.message}
                onChange={(e) =>
                  setContact((s) => ({
                    ...s,
                    message: e.target.value.slice(0, 1000),
                  }))
                }
                rows={3}
                maxLength={1000}
                placeholder="Arrival time, special requests, anything the host should know…"
                className="w-full resize-none rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
              />
            </div>
            {isAuthenticated ? (
              <p className="-mt-1 text-xs text-brand-mute sm:col-span-2">
                Booking as{" "}
                <span className="font-mono text-brand-ink">{guestEmail}</span>.{" "}
                <button
                  type="button"
                  onClick={logOut}
                  disabled={loggingOut}
                  className="font-medium text-brand-primary hover:underline disabled:opacity-50"
                >
                  {loggingOut
                    ? "Logging out…"
                    : "Not you? Log out & use another account"}
                </button>
              </p>
            ) : (
              <p className="-mt-1 text-xs text-brand-mute sm:col-span-2">
                Already have an account?{" "}
                <a
                  href={`/login?next=${encodeURIComponent(
                    `/listing/${listingSlug}/book`,
                  )}`}
                  className="font-medium text-brand-primary hover:underline"
                >
                  Sign in
                </a>{" "}
                to book faster.
              </p>
            )}
          </div>
        </section>

        {/* Payment */}
        <section className={cardLabel}>
          <div className="border-b border-brand-line px-5 py-4">
            <div className="font-display font-semibold text-brand-ink">
              Payment
            </div>
            <div className="mt-0.5 text-xs text-brand-mute">
              Vilo never charges a booking fee.
            </div>
          </div>
          <div className="space-y-2.5 p-5">
            {paymentMethods.map((m) => {
              const selected = method === m.id;
              const Icon = m.Icon;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  disabled={isPending}
                  className={`flex w-full items-center gap-4 rounded-card border px-5 py-4 text-left transition ${
                    selected
                      ? "border-2 border-brand-primary bg-brand-accent/30"
                      : "border border-brand-line bg-white hover:border-brand-primary/50"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 transition ${
                      selected
                        ? "border-brand-primary bg-brand-primary text-white"
                        : "border-brand-line bg-white"
                    }`}
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-pill bg-white" />
                    ) : null}
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-brand-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-brand-ink">{m.label}</div>
                    <div className="mt-0.5 text-xs text-brand-mute">
                      {m.sub}
                    </div>
                  </div>
                  {m.id === "paystack" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand-mute">
                      <Lock className="h-3 w-3" /> Encrypted
                    </span>
                  ) : null}
                </button>
              );
            })}
            {method === "eft" ? (
              <div className="rounded border border-dashed border-brand-line bg-brand-light/40 p-3 text-xs text-brand-mute">
                After you reserve, you&rsquo;ll get the host&rsquo;s banking
                details and a reference here to complete the transfer.
              </div>
            ) : null}
          </div>
        </section>

        {/* Cancellation policy */}
        <section className="rounded-card border border-brand-line bg-brand-light/50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand-line bg-white text-brand-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold capitalize text-brand-ink">
                {cancellationPolicy} cancellation policy
              </div>
              <p className="mt-1 text-sm text-brand-ink">
                {CANCELLATION_BLURB[cancellationPolicy]}
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded border border-brand-line bg-white p-3">
                <Checkbox
                  checked={policyAck}
                  onCheckedChange={(v) => setPolicyAck(v === true)}
                  className="mt-0.5"
                  disabled={isPending}
                />
                <span className="text-sm text-brand-ink">
                  I&rsquo;ve read the cancellation policy and house rules.
                </span>
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* ── Right column: sticky summary ────────────────────────── */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          {/* Cover image / placeholder with identity overlay */}
          <div className="relative h-40 w-full">
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-brand-gradient-dark" />
            )}
            {instantBooking ? (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary backdrop-blur">
                <Zap className="h-3 w-3" /> Instant Book
              </span>
            ) : null}
          </div>

          <div className="border-b border-brand-line px-5 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              {locationLine
                ? `${listingTypeLabel} · ${locationLine}`
                : listingTypeLabel}
            </div>
            <div className="mt-0.5 truncate font-display text-lg font-bold text-brand-ink">
              {listingName}
            </div>
            {ratingValue != null ? (
              <div className="mt-1 flex items-center gap-1 text-xs text-brand-ink">
                <Star className="h-3.5 w-3.5 fill-brand-primary text-brand-primary" />
                <span className="font-semibold">{ratingValue.toFixed(2)}</span>
                <span className="text-brand-mute">
                  · {reviewCount ?? 0}{" "}
                  {(reviewCount ?? 0) === 1 ? "review" : "reviews"}
                </span>
              </div>
            ) : null}
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-brand-line p-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                  Check-in
                </div>
                <div className="mt-0.5 text-sm font-medium text-brand-ink">
                  {fmtDate(checkIn)}
                </div>
              </div>
              <div className="rounded border border-brand-line p-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                  Check-out
                </div>
                <div className="mt-0.5 text-sm font-medium text-brand-ink">
                  {fmtDate(checkOut)}
                </div>
              </div>
            </div>

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">
                  {scope === "rooms"
                    ? `${selectedRooms.length} ${
                        selectedRooms.length === 1 ? "room" : "rooms"
                      } × ${nights} ${nights === 1 ? "night" : "nights"}`
                    : `${fmtR(basePrice, currency)} × ${nights} ${
                        nights === 1 ? "night" : "nights"
                      }`}
                </dt>
                <dd className="font-medium text-brand-dark">
                  {fmtR(subtotal, currency)}
                </dd>
              </div>
              {cleaningTotal > 0 ? (
                <div className="flex items-center justify-between">
                  <dt className="text-brand-mute">
                    {scope === "rooms" ? "Cleaning fees" : "Cleaning fee"}
                  </dt>
                  <dd className="font-medium text-brand-dark">
                    {fmtR(cleaningTotal, currency)}
                  </dd>
                </div>
              ) : null}
              {selectedAddonLines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between"
                >
                  <dt className="truncate pr-2 text-brand-mute">{line.name}</dt>
                  <dd className="font-medium text-brand-dark">
                    {fmtR(line.subtotal, currency)}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <dt className="text-brand-mute">Vilo service fee</dt>
                <dd className="font-medium text-brand-primary">FREE</dd>
              </div>
              <div className="flex items-center justify-between border-t border-brand-line pt-3">
                <dt className="font-display font-semibold text-brand-ink">
                  Total
                </dt>
                <dd className="font-display text-lg font-bold text-brand-ink">
                  {fmtR(total, currency)}
                </dd>
              </div>
            </dl>

            <button
              type="submit"
              disabled={reserveDisabled}
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {reserveLabel}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-brand-mute">
              <Mail className="h-3 w-3" />
              {method === "eft"
                ? "You’ll get the host’s banking details to complete payment."
                : isAuthenticated
                  ? "You won’t be charged until payment completes."
                  : "We’ll create your guest account, then open secure checkout."}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile sticky action bar ────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-base font-bold text-brand-ink">
              {fmtR(total, currency)}
            </div>
            <div className="truncate text-[11px] text-brand-mute">
              {nights} {nights === 1 ? "night" : "nights"} · {effectiveGuests}{" "}
              {effectiveGuests === 1 ? "guest" : "guests"}
            </div>
          </div>
          <button
            type="submit"
            disabled={reserveDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            {isPending ? "Working…" : "Reserve"}
          </button>
        </div>
      </div>
    </form>
  );
}
