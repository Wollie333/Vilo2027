"use client";

import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  CreditCard,
  Home,
  Info,
  Loader2,
  Lock,
  Mail,
  Minus,
  Moon,
  PackagePlus,
  Percent,
  Plus,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import {
  PRICING_LABEL,
  clampAddonQuantity,
  computeAddonSubtotal,
  defaultAddonQuantity,
  isPerNightModel,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import {
  roomFromNightly,
  roomNightlyBase,
  type RoomPricingMode,
} from "../roomDisplay";
import {
  computeAgeExtras,
  priceStay,
  type PricingUnit,
  type ResolvedCoupon,
  type SeasonalRule,
  type StayAddon,
} from "@/lib/pricing";
import {
  checkAvailabilityAction,
  createBookingAction,
  createCheckoutGuestAccountAction,
  validateCouponAction,
} from "./actions";
import { CheckoutDateEditor } from "./CheckoutDateEditor";

export type RoomOption = {
  id: string;
  name: string;
  bedsLabel: string;
  photoUrl: string | null;
  features: string[];
  maxGuests: number;
  minGuests: number;
  minNights: number;
  cleaningFee: number;
  pricingMode: RoomPricingMode;
  basePrice: number;
  weekendPrice: number | null;
  pricePerPerson: number | null;
  baseOccupancy: number | null;
  extraGuestPrice: number | null;
  childPrice: number;
  infantPrice: number;
  petFee: number;
  allowChildren: boolean;
  allowInfants: boolean;
  allowPets: boolean;
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
  allowCustomQuantity: boolean;
  stockQuantity: number | null;
  isRequired: boolean;
  leadTimeDays: number;
};

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

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const f = new Date(`${a}T00:00:00Z`).getTime();
  const t = new Date(`${b}T00:00:00Z`).getTime();
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (1000 * 60 * 60 * 24));
}

/** Whole days from today (UTC) to an ISO date — the guest's booking lead time. */
function leadDaysUntil(iso: string): number {
  if (!iso) return 0;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const target = new Date(`${iso}T00:00:00Z`);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

const CANCELLATION_BULLETS: Record<
  "flexible" | "moderate" | "strict",
  { dot: string; text: string }[]
> = {
  flexible: [
    {
      dot: "bg-brand-primary",
      text: "Full refund up to 24 hours before check-in.",
    },
    {
      dot: "bg-amber-500",
      text: "After that, the first night is non-refundable.",
    },
    { dot: "bg-red-500", text: "No-shows are charged in full." },
  ],
  moderate: [
    {
      dot: "bg-brand-primary",
      text: "Cancel 5+ days before check-in for a full refund.",
    },
    {
      dot: "bg-amber-500",
      text: "Cancel 1–4 days before check-in for a 50% refund.",
    },
    {
      dot: "bg-red-500",
      text: "Cancel within 24 hours of check-in — no refund.",
    },
  ],
  strict: [
    {
      dot: "bg-brand-primary",
      text: "50% refund up to 7 days before check-in.",
    },
    {
      dot: "bg-amber-500",
      text: "After 7 days, the booking is non-refundable.",
    },
    { dot: "bg-red-500", text: "No-shows are charged in full." },
  ],
};

const STEPS = ["Rooms", "Details", "Payment"];

export function BookingForm({
  listingId,
  listingSlug,
  listingName,
  hostName,
  hostAvatarUrl,
  listingTypeLabel,
  listingCity,
  listingProvince,
  coverImageUrl,
  basePrice,
  weekendPrice: listingWeekendPrice,
  cleaningFee,
  listingChildPrice,
  listingInfantPrice,
  listingPetFee,
  listingAllowChildren,
  listingAllowInfants,
  listingAllowPets,
  currency,
  cancellationPolicy,
  instantBooking,
  bookingMode,
  checkIn,
  checkOut,
  minNights,
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
  hasPaystack,
  seasonalRules,
  wholeListingDiscountPct,
  weeklyDiscountPct,
  monthlyDiscountPct,
}: {
  listingId: string;
  listingSlug: string;
  listingName: string;
  hostName: string | null;
  hostAvatarUrl: string | null;
  listingTypeLabel: string;
  listingCity: string | null;
  listingProvince: string | null;
  coverImageUrl: string | null;
  basePrice: number;
  weekendPrice: number | null;
  cleaningFee: number;
  listingChildPrice: number;
  listingInfantPrice: number;
  listingPetFee: number;
  listingAllowChildren: boolean;
  listingAllowInfants: boolean;
  listingAllowPets: boolean;
  currency: string;
  cancellationPolicy: "flexible" | "moderate" | "strict";
  instantBooking: boolean;
  bookingMode: string;
  checkIn: string;
  checkOut: string;
  minNights: number;
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
  hasPaystack: boolean;
  seasonalRules: SeasonalRule[];
  wholeListingDiscountPct: number | null;
  weeklyDiscountPct: number | null;
  monthlyDiscountPct: number | null;
}) {
  const router = useRouter();
  const brandName = useBrandName();
  const [isPending, start] = useTransition();
  const [loggingOut, startLogout] = useTransition();

  // ── Wizard step ───────────────────────────────────────────────
  // 0 = Rooms (dates/guests/room selection), 1 = Details (contact/add-ons),
  // 2 = Payment. Confirmation is the post-redirect success page
  // (/booking/[id]/success), so it isn't rendered in-form.
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // ── Dates ─────────────────────────────────────────────────────
  const [dates, setDates] = useState({ from: checkIn, to: checkOut });
  const nights = useMemo(() => nightsBetween(dates.from, dates.to), [dates]);

  // ── Room selection state ──────────────────────────────────────
  const roomsMode = allRooms.length > 0;
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(
    () => initialSelectedRoomIds,
  );
  const [roomGuests, setRoomGuests] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const r of allRooms) {
      const want = initialRoomGuests[r.id] ?? r.minGuests;
      init[r.id] = Math.min(Math.max(r.minGuests, want), r.maxGuests);
    }
    return init;
  });
  function setRoomGuestCount(room: RoomOption, next: number) {
    setRoomGuests((prev) => ({
      ...prev,
      [room.id]: Math.min(Math.max(room.minGuests, next), room.maxGuests),
    }));
  }

  const effectiveMinNights = useMemo(() => {
    const sel = allRooms.filter((r) => selectedRoomIds.includes(r.id));
    return Math.max(minNights, 1, ...sel.map((r) => r.minNights));
  }, [allRooms, selectedRoomIds, minNights]);
  const datesValid =
    Boolean(dates.from && dates.to) && nights >= effectiveMinNights;
  const [wholeListing, setWholeListing] = useState(false);
  const [guestCount, setGuestCount] = useState(wholeGuests);

  // ── Live availability for the chosen dates (step 1) ────────────
  // null = not checked yet (treat everything as available). Mirrors the server
  // RPCs; the booking action re-checks authoritatively at submit.
  const [availability, setAvailability] = useState<{
    whole: boolean;
    rooms: Record<string, boolean>;
  } | null>(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const roomAvailable = (roomId: string) =>
    availability?.rooms[roomId] !== false;
  const wholeAvailable = availability?.whole !== false;
  // The whole place can be unavailable (a room is taken) while individual rooms
  // are still free — they book independently. Used to keep the "whole place
  // unavailable" notice from implying the dates are fully gone.
  const anyRoomAvailable =
    allRooms.length > 0 && allRooms.some((r) => roomAvailable(r.id));
  // Party split for age-based pricing (children/infants/pets priced separately).
  const [childrenCount, setChildrenCount] = useState(0);
  const [infantsCount, setInfantsCount] = useState(0);
  const [petsCount, setPetsCount] = useState(0);

  // ── Contact / account state ───────────────────────────────────
  const [contact, setContact] = useState({
    fullName: guestName,
    email: guestEmail,
    phone: guestPhone,
    password: "",
    message: "",
  });

  // ── Coupon ────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<ResolvedCoupon | null>(
    null,
  );
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, startCoupon] = useTransition();

  // ── Optional party manifest (name + contact per guest) ─────────
  const [party, setParty] = useState<
    { name: string; email: string; phone: string }[]
  >([]);
  function addGuest() {
    setParty((p) => [...p, { name: "", email: "", phone: "" }]);
  }
  function removeGuest(i: number) {
    setParty((p) => p.filter((_, idx) => idx !== i));
  }
  function updateGuest(
    i: number,
    patch: Partial<{ name: string; email: string; phone: string }>,
  ) {
    setParty((p) => p.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }

  // ── Payment method state ──────────────────────────────────────
  // Card is only available when the host has connected their own Paystack;
  // otherwise the guest pays by EFT. Default to whichever the host offers.
  const [method, setMethod] = useState<"paystack" | "eft">(
    hasPaystack ? "paystack" : "eft",
  );

  // Pre-select required addons at their default quantity.
  const [addonQty, setAddonQty] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const a of availableAddons) {
      if (a.isRequired) {
        m.set(
          a.id,
          defaultAddonQuantity(a.pricingModel, a.minQuantity, nights),
        );
      }
    }
    return m;
  });

  function toggleAddon(addonId: string) {
    const a = availableAddons.find((x) => x.id === addonId);
    if (!a || a.isRequired) return;
    if (a.stockQuantity != null && a.stockQuantity <= 0) return;
    setAddonQty((prev) => {
      const next = new Map(prev);
      if (next.has(addonId)) next.delete(addonId);
      else
        next.set(
          addonId,
          defaultAddonQuantity(a.pricingModel, a.minQuantity, nights),
        );
      return next;
    });
  }

  function setAddonQuantity(addonId: string, desired: number) {
    const a = availableAddons.find((x) => x.id === addonId);
    if (!a) return;
    const qty = clampAddonQuantity(a.pricingModel, desired, {
      minQuantity: a.minQuantity,
      maxQuantity: a.maxQuantity,
      nights,
      stock: a.stockQuantity,
      allowCustom: a.allowCustomQuantity,
    });
    setAddonQty((prev) => {
      if (!prev.has(addonId)) return prev;
      const next = new Map(prev);
      next.set(addonId, qty);
      return next;
    });
  }

  const leadDays = leadDaysUntil(dates.from);
  const eligibleAddons = useMemo(
    () => availableAddons.filter((a) => leadDays >= a.leadTimeDays),
    [availableAddons, leadDays],
  );
  useEffect(() => {
    setAddonQty((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, qty] of prev) {
        const a = availableAddons.find((x) => x.id === id);
        if (!a || leadDays < a.leadTimeDays) {
          next.delete(id);
          changed = true;
          continue;
        }
        const clamped = clampAddonQuantity(a.pricingModel, qty, {
          minQuantity: a.minQuantity,
          maxQuantity: a.maxQuantity,
          nights,
          stock: a.stockQuantity,
          allowCustom: a.allowCustomQuantity,
        });
        if (clamped !== qty) {
          next.set(id, clamped);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [leadDays, availableAddons, nights]);

  // Re-check availability whenever the (valid) date range changes. Small debounce
  // so rapid date edits don't spam the server. The booking action re-checks.
  useEffect(() => {
    if (!datesValid) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setCheckingAvail(true);
    const t = setTimeout(async () => {
      const res = await checkAvailabilityAction({
        listing_id: listingId,
        check_in: dates.from,
        check_out: dates.to,
        room_ids: allRooms.map((r) => r.id),
      });
      if (cancelled) return;
      setCheckingAvail(false);
      if (res.ok) setAvailability({ whole: res.whole, rooms: res.rooms });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [datesValid, dates.from, dates.to, listingId, allRooms]);

  // Drop any selected room (or whole-place) that just became unavailable so the
  // summary, price and submit never include a date-blocked room.
  useEffect(() => {
    if (!availability) return;
    setSelectedRoomIds((prev) => {
      const next = prev.filter((id) => availability.rooms[id] !== false);
      return next.length === prev.length ? prev : next;
    });
    if (wholeListing && !availability.whole) setWholeListing(false);
  }, [availability, wholeListing]);

  function toggleRoom(roomId: string) {
    if (!roomAvailable(roomId)) return;
    setSelectedRoomIds((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId],
    );
  }

  const guestsForRoom = (r: RoomOption) =>
    Math.min(
      Math.max(r.minGuests, roomGuests[r.id] ?? r.minGuests),
      r.maxGuests,
    );

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

  const effectiveGuests = isWhole
    ? guestCount
    : selectedRooms.reduce((acc, r) => acc + guestsForRoom(r), 0);

  // Sleeping capacity: adults (effectiveGuests) + children must fit. Infants +
  // pets don't count. Caps the children stepper so the room can't be oversold.
  const capacityLimit = isWhole
    ? maxGuestsWhole
    : selectedRooms.reduce((acc, r) => acc + r.maxGuests, 0) || Infinity;
  const childrenRemaining = Math.max(
    0,
    (capacityLimit === Infinity ? 999 : capacityLimit) -
      effectiveGuests -
      childrenCount,
  );

  const scope: "whole_listing" | "rooms" =
    roomsMode && !wholeListing && selectedRooms.length > 0
      ? "rooms"
      : "whole_listing";

  // ── Live pricing via the canonical engine ─────────────────────
  // The SAME priceStay() the server charges with, so this estimate equals the
  // charged total to the cent — seasonal/weekend nights, occupancy, discounts,
  // cleaning and add-ons all included. Pure + cheap, so computed each render.
  const breakdown = datesValid
    ? priceStay({
        checkIn: dates.from,
        checkOut: dates.to,
        units: isWhole
          ? [
              {
                roomId: null,
                pricing_mode: "per_room",
                base_price: basePrice,
                price_per_person: null,
                base_occupancy: null,
                extra_guest_price: null,
                weekend_price: listingWeekendPrice,
                cleaning_fee: cleaningFee,
                guests: guestCount,
              },
            ]
          : selectedRooms.map(
              (r): PricingUnit => ({
                roomId: r.id,
                pricing_mode: r.pricingMode,
                base_price: r.basePrice,
                price_per_person: r.pricePerPerson,
                base_occupancy: r.baseOccupancy,
                extra_guest_price: r.extraGuestPrice,
                weekend_price: r.weekendPrice,
                cleaning_fee: r.cleaningFee,
                guests: guestsForRoom(r),
              }),
            ),
        seasonalRules,
        currency,
        totalGuests: effectiveGuests,
        listingMinNights: minNights,
        isWholeCombo:
          scope === "rooms" &&
          allRooms.length > 1 &&
          selectedRooms.length === allRooms.length,
        wholePct: wholeListingDiscountPct,
        weeklyPct: weeklyDiscountPct,
        monthlyPct: monthlyDiscountPct,
        coupon: appliedCoupon,
        addons: [...addonQty.entries()].flatMap(([id, qty]) => {
          const a = availableAddons.find((x) => x.id === id);
          if (!a || qty <= 0) return [];
          const line: StayAddon = {
            label: a.name,
            pricingModel: a.pricingModel,
            unitPrice: a.unitPrice,
            quantity: qty,
            addonId: id,
          };
          return [line];
        }),
      })
    : null;

  const subtotal = breakdown?.baseSubtotal ?? 0;
  const cleaningTotal = breakdown?.cleaningTotal ?? 0;
  const addonsTotal = breakdown?.addonsTotal ?? 0;
  const discountTotal = breakdown?.discount.discountTotal ?? 0;
  const couponDiscount = breakdown?.couponDiscount ?? 0;
  const seasonalNights = breakdown?.seasonalNights ?? 0;
  const weekendNights = breakdown?.weekendNights ?? 0;

  // A coupon is validated against specific dates/rooms/amounts — drop it when
  // any of those change so a stale discount can't be shown (or charged).
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.from, dates.to, selectedRoomIds, wholeListing]);

  function applyCoupon() {
    const code = couponInput.trim();
    if (!code || !breakdown) return;
    setCouponError(null);
    const accommodationAmount =
      breakdown.baseSubtotal - breakdown.discount.discountTotal;
    startCoupon(async () => {
      const res = await validateCouponAction({
        code,
        listing_id: listingId,
        check_in: dates.from,
        check_out: dates.to,
        room_ids: scope === "rooms" ? selectedRooms.map((r) => r.id) : [],
        addon_ids: [...addonQty.entries()]
          .filter(([, q]) => q > 0)
          .map(([id]) => id),
        accommodation_amount: accommodationAmount,
        addons_amount: breakdown.addonsTotal,
      });
      if (!res.ok) {
        setAppliedCoupon(null);
        setCouponError(res.error);
        return;
      }
      setAppliedCoupon(res.coupon);
      toast.success("Coupon applied");
    });
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

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
          effectiveGuests,
        ),
      });
    }
    return lines;
  }, [addonQty, availableAddons, effectiveGuests]);

  // Which categories the host allows. Rooms scope: a category is allowed only
  // if EVERY selected room allows it. Whole-listing: the listing's flags.
  const allow = useMemo(() => {
    if (scope === "rooms" && selectedRooms.length > 0) {
      return {
        children: selectedRooms.every((r) => r.allowChildren),
        infants: selectedRooms.every((r) => r.allowInfants),
        pets: selectedRooms.every((r) => r.allowPets),
      };
    }
    return {
      children: listingAllowChildren,
      infants: listingAllowInfants,
      pets: listingAllowPets,
    };
  }, [
    scope,
    selectedRooms,
    listingAllowChildren,
    listingAllowInfants,
    listingAllowPets,
  ]);

  // Reset a category's count when it becomes disallowed (e.g. room change).
  useEffect(() => {
    if (!allow.children && childrenCount > 0) setChildrenCount(0);
    if (!allow.infants && infantsCount > 0) setInfantsCount(0);
    if (!allow.pets && petsCount > 0) setPetsCount(0);
  }, [allow, childrenCount, infantsCount, petsCount]);

  // Age/pet extras for the live preview — same maths the server charges with.
  // Rooms scope uses the first selected room's rates; whole-listing the listing's.
  const ageExtras = useMemo(() => {
    if (!datesValid) return { lines: [], total: 0 };
    const rates =
      scope === "rooms" && selectedRooms[0]
        ? {
            childPrice: selectedRooms[0].childPrice,
            infantPrice: selectedRooms[0].infantPrice,
            petFee: selectedRooms[0].petFee,
          }
        : {
            childPrice: listingChildPrice,
            infantPrice: listingInfantPrice,
            petFee: listingPetFee,
          };
    return computeAgeExtras(
      {
        adults: 0,
        children: childrenCount,
        infants: infantsCount,
        pets: petsCount,
      },
      rates,
      nights,
    );
  }, [
    datesValid,
    scope,
    selectedRooms,
    listingChildPrice,
    listingInfantPrice,
    listingPetFee,
    childrenCount,
    infantsCount,
    petsCount,
    nights,
  ]);

  const total = (breakdown?.total ?? 0) + ageExtras.total;

  const needsRoom = roomsMode && !wholeListing && selectedRooms.length === 0;
  // Step 1 can't advance until dates are valid, a room (or whole place) is
  // chosen, and that choice is actually available for the dates.
  const step0Blocked = !datesValid || needsRoom || (isWhole && !wholeAvailable);
  // A plain-language reason for the disabled Continue, shown on the rooms step
  // so the guest always knows why they can't move on.
  const step0Reason: string | null = !datesValid
    ? "Choose your check-in and check-out dates to continue."
    : isWhole && !wholeAvailable
      ? "The whole place is booked for these dates — pick other dates or book an available room."
      : needsRoom
        ? anyRoomAvailable
          ? "Select an available room to continue."
          : "No rooms are available for these dates — try different dates."
        : null;

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

  /** Step 1 (Rooms): valid dates + at least one room (when room-based). */
  function validateRooms(): boolean {
    if (!datesValid) {
      toast.error(
        `Choose dates of at least ${effectiveMinNights} ${
          effectiveMinNights === 1 ? "night" : "nights"
        }.`,
      );
      return false;
    }
    if (needsRoom) {
      toast.error("Select at least one room to continue.");
      return false;
    }
    if (isWhole && !wholeAvailable) {
      toast.error("These dates aren't available. Try different ones.");
      return false;
    }
    return true;
  }

  /** Step 2 (Details): contact + (for guests) a password. */
  function validateDetails(): boolean {
    if (!isAuthenticated) {
      if (
        contact.fullName.trim().length < 2 ||
        !contact.email.includes("@") ||
        contact.password.length < 8
      ) {
        toast.error("Add your name, email and a password (8+ characters).");
        return false;
      }
    } else if (contact.fullName.trim().length < 2) {
      toast.error("Please add the name we should put on the booking.");
      return false;
    }
    // Party manifest is optional, but a started row must have a name AND a valid
    // email so each added guest becomes their own contactable record.
    const partial = party.some((g) => {
      const hasName = g.name.trim().length > 0;
      const hasEmail = /\S+@\S+\.\S+/.test(g.email.trim());
      return (hasName || g.email.trim().length > 0) && !(hasName && hasEmail);
    });
    if (partial) {
      toast.error("Each added guest needs a name and a valid email.");
      return false;
    }
    return true;
  }

  function goNext() {
    if (step === 0) {
      if (!validateRooms()) return;
      setStep(1);
    } else if (step === 1) {
      if (!validateDetails()) return;
      setStep(2);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goBack() {
    setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2) : 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Payment fires ONLY from an explicit click on the Pay button (below). It is
  // never wired to the form's submit event, so an implicit submit — Enter in the
  // coupon field, a stray button — can never charge the guest before they
  // choose a method and tap Pay on step 3.
  function pay() {
    if (isPending || !canPay) return;
    if (!validateRooms()) {
      setStep(0);
      return;
    }
    if (!validateDetails()) {
      setStep(1);
      return;
    }

    start(async () => {
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
        check_in: dates.from,
        check_out: dates.to,
        guests: effectiveGuests,
        children: childrenCount,
        infants: infantsCount,
        pets: petsCount,
        payment_method: method,
        policy_acknowledged: true,
        selected_addons: Array.from(addonQty.entries())
          .filter(([, q]) => q > 0)
          .map(([addon_id, quantity]) => ({ addon_id, quantity })),
        coupon_code: appliedCoupon?.code,
        guest_name: guestNameOut,
        guest_email: guestEmailOut,
        guest_phone: guestPhoneOut,
        special_requests: messageOut,
        // Each named party member needs a name AND email (so they get their own
        // guest record). Drop fully-empty rows; only complete rows are sent.
        additional_guests: party
          .map((g) => ({
            name: g.name.trim(),
            email: g.email.trim(),
            phone: g.phone.trim(),
          }))
          .filter((g) => g.name.length > 0 || g.email.length > 0),
      });
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  const payLabel = isPending
    ? !isAuthenticated
      ? "Creating account…"
      : method === "eft"
        ? "Reserving…"
        : "Redirecting to Paystack…"
    : method === "eft"
      ? "Reserve & get bank details"
      : `Pay ${formatMoney(total, currency)}`;

  const cardLabel = "rounded-card border border-brand-line bg-white";
  const sectionHead =
    "px-5 py-4 border-b border-brand-line flex items-center justify-between gap-3";

  const paymentMethods = [
    ...(hasPaystack
      ? [
          {
            id: "paystack" as const,
            label: "Pay with card",
            sub: "Visa, Mastercard & instant EFT · secured by Paystack",
            Icon: CreditCard,
            cards: ["visa", "mc"] as const,
          },
        ]
      : []),
    ...(hasEftBanking
      ? [
          {
            id: "eft" as const,
            label: "EFT bank transfer",
            sub: "Manual transfer · verified by the host",
            Icon: Building2,
            cards: undefined,
          },
        ]
      : []),
  ];

  // The guest can only pay when there's a real, available, priced stay AND the
  // host offers at least one payment rail. Guards the R0 / room-just-became-
  // unavailable / host-has-no-payment-method cases so we never charge nothing.
  const noPriceableStay =
    !datesValid ||
    total <= 0 ||
    (scope === "rooms" && selectedRooms.length === 0);
  const canPay = !noPriceableStay && paymentMethods.length > 0;

  /* ── Step 1 · Rooms (dates, guests, room selection) ────────── */
  const roomsBody = (
    <div className="ck-step space-y-7">
      <header>
        <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
          Step 1 of 3
        </div>
        <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-[28px]">
          Choose your rooms &amp; dates
        </h2>
        <p className="mt-1.5 text-sm text-brand-mute">
          Pick when you&rsquo;re coming and the rooms you&rsquo;d like — book
          one, a few, or the whole place.
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
                {needsRoom
                  ? "Select at least one room to continue."
                  : wholeListing
                    ? "Booking the whole place"
                    : `${selectedRooms.length} of ${allRooms.length} ${
                        allRooms.length === 1 ? "room" : "rooms"
                      } selected`}
              </div>
            </div>
          </div>

          {/* Prominent whole-place toggle (design signature) */}
          {bookingMode !== "rooms_only" && basePrice > 0 ? (
            <div className="px-4 pt-4 sm:px-5">
              <button
                type="button"
                onClick={() => setWholeListing((v) => !v)}
                disabled={isPending || (!wholeListing && !wholeAvailable)}
                aria-pressed={wholeListing}
                className={`flex w-full items-center gap-3 rounded-card border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  wholeListing
                    ? "ck-selected border-brand-primary bg-brand-light/50"
                    : "border-brand-line bg-white hover:border-brand-primary/50"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-secondary">
                  <Home className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-brand-ink">
                    Book the whole place
                  </div>
                  <div className="text-xs text-brand-mute">
                    All {allRooms.length}{" "}
                    {allRooms.length === 1 ? "room" : "rooms"}
                    {wholeListingDiscountPct && wholeListingDiscountPct > 0 ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-semibold text-brand-primary">
                          save {wholeListingDiscountPct}%
                        </span>
                      </>
                    ) : null}
                    {!wholeAvailable ? " · unavailable for these dates" : ""}
                  </div>
                </div>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    wholeListing
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line bg-white"
                  }`}
                >
                  {wholeListing ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
              </button>
            </div>
          ) : null}

          {wholeListing ? (
            <div className="flex items-center gap-3 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-brand-ink">{listingName}</div>
                <div className="text-xs text-brand-mute">
                  {formatMoney(basePrice, currency)} / night
                  {cleaningFee > 0
                    ? ` · ${formatMoney(cleaningFee, currency)} cleaning`
                    : ""}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 p-4 sm:p-5">
              {needsRoom ? (
                <div className="inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  <Info className="h-4 w-4" /> Select at least one room to
                  continue.
                </div>
              ) : null}
              {allRooms.map((r) => {
                const selected = selectedRoomIds.includes(r.id);
                const nightly = roomNightly(r);
                const g = guestsForRoom(r);
                const available = roomAvailable(r.id);
                return (
                  <div
                    key={r.id}
                    className={`overflow-hidden rounded-card border bg-white transition ${
                      !available
                        ? "border-brand-line opacity-60"
                        : selected
                          ? "ck-selected border-brand-primary"
                          : "border-brand-line hover:border-brand-primary/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleRoom(r.id)}
                      disabled={isPending || !available}
                      className={`flex w-full items-stretch gap-3 p-3 text-left transition sm:gap-4 sm:p-4 ${
                        available
                          ? "hover:bg-brand-light/40"
                          : "cursor-not-allowed"
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
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-mute">
                              <BedDouble className="h-3.5 w-3.5" />
                              {r.bedsLabel ? `${r.bedsLabel}` : "Room"}
                              <span className="text-brand-line">·</span>
                              <Users className="h-3.5 w-3.5" />
                              Sleeps {r.maxGuests}
                            </div>
                          </div>
                          {available ? (
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                                selected
                                  ? "border-brand-primary bg-brand-primary text-white"
                                  : "border-brand-line bg-white"
                              }`}
                            >
                              {selected ? <Check className="h-3 w-3" /> : null}
                            </div>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-cancelled">
                              Unavailable
                            </span>
                          )}
                        </div>
                        {r.features.length > 0 ? (
                          <div className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
                            {r.features.map((f) => (
                              <span
                                key={f}
                                className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-baseline justify-between gap-3">
                          <div className="text-xs text-brand-mute">
                            <span className="font-semibold text-brand-ink">
                              {formatMoney(
                                roomFromNightly(toPricing(r)),
                                currency,
                              )}
                            </span>{" "}
                            / night
                            {r.cleaningFee > 0
                              ? ` · ${formatMoney(r.cleaningFee, currency)} cleaning`
                              : ""}
                          </div>
                          {available ? (
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-pill border px-3 py-1 text-xs font-semibold transition ${
                                selected
                                  ? "border-brand-primary bg-brand-primary text-white"
                                  : "border-brand-line text-brand-ink"
                              }`}
                            >
                              {selected ? (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Added
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" /> Add room
                                </>
                              )}
                            </span>
                          ) : null}
                        </div>
                        {selected ? (
                          <div className="mt-1.5 text-right font-mono text-[11px] text-brand-secondary">
                            × {nights} ={" "}
                            <span className="font-semibold">
                              {formatMoney(
                                nightly * nights + r.cleaningFee,
                                currency,
                              )}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </button>

                    {selected ? (
                      <div className="flex items-center justify-between gap-3 border-t border-brand-line/70 px-3 py-2.5 sm:px-4">
                        <div className="text-xs font-medium text-brand-ink">
                          Guests in this room
                          <span className="ml-1 font-normal text-brand-mute">
                            · max {r.maxGuests}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setRoomGuestCount(r, g - 1)}
                            disabled={isPending || g <= r.minGuests}
                            aria-label="Fewer guests"
                            className="flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line text-brand-ink transition hover:bg-brand-accent disabled:opacity-30"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-semibold tabular-nums text-brand-ink">
                            {g}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRoomGuestCount(r, g + 1)}
                            disabled={isPending || g >= r.maxGuests}
                            aria-label="More guests"
                            className="flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line text-brand-ink transition hover:bg-brand-accent disabled:opacity-30"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
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
                {formatMoney(basePrice, currency)} / night
                {cleaningFee > 0
                  ? ` · ${formatMoney(cleaningFee, currency)} cleaning`
                  : ""}
              </div>
            </div>
          </div>
          {datesValid && !wholeAvailable ? (
            anyRoomAvailable ? (
              <div className="mx-5 mb-5 inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <Info className="h-4 w-4" /> The whole place is taken for these
                dates — but you can still book an available room below.
              </div>
            ) : (
              <div className="mx-5 mb-5 inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                <Info className="h-4 w-4" /> Not available for these dates — try
                different ones.
              </div>
            )
          ) : null}
        </section>
      )}

      {/* Your trip — dates (calendar) + guests */}
      <section className={cardLabel}>
        <div className={sectionHead}>
          <div>
            <div className="font-display font-semibold text-brand-ink">
              Your trip
            </div>
            <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-brand-mute">
              {nights} {nights === 1 ? "night" : "nights"}
              {checkingAvail ? (
                <span className="inline-flex items-center gap-1 text-brand-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> checking
                  availability…
                </span>
              ) : null}
            </div>
          </div>
          {instantBooking ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
              <Zap className="h-3 w-3" /> Instant Book
            </span>
          ) : null}
        </div>
        {/* The guest's own calendar lives right here in the card. */}
        <CheckoutDateEditor
          from={dates.from}
          to={dates.to}
          minNights={effectiveMinNights}
          onChange={(from, to) => setDates({ from, to })}
        />
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

          {/* Children / infants / pets — only the categories the host allows;
              priced per the host's room rates. */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                // [label, value, setter, allowed, atMax] — only children count
                // toward sleeping capacity, so only it is capped.
                [
                  "Children",
                  childrenCount,
                  setChildrenCount,
                  allow.children,
                  childrenRemaining <= 0,
                ],
                [
                  "Infants",
                  infantsCount,
                  setInfantsCount,
                  allow.infants,
                  false,
                ],
                ["Pets", petsCount, setPetsCount, allow.pets, false],
              ] as const
            )
              .filter(([, , , allowed]) => allowed)
              .map(([label, value, setter, , atMax]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded border border-brand-line bg-white px-3 py-2"
                >
                  <span className="text-xs font-medium text-brand-ink">
                    {label}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setter(Math.max(0, value - 1))}
                      disabled={isPending || value <= 0}
                      className="flex h-6 w-6 items-center justify-center rounded border border-brand-line text-brand-mute disabled:opacity-40"
                      aria-label={`Fewer ${label.toLowerCase()}`}
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm font-semibold text-brand-ink">
                      {value}
                    </span>
                    <button
                      type="button"
                      onClick={() => !atMax && setter(value + 1)}
                      disabled={isPending || atMax}
                      className="flex h-6 w-6 items-center justify-center rounded border border-brand-line text-brand-mute disabled:opacity-40"
                      aria-label={`More ${label.toLowerCase()}`}
                    >
                      +
                    </button>
                  </span>
                </div>
              ))}
          </div>
          {capacityLimit !== Infinity &&
          effectiveGuests + childrenCount >= capacityLimit ? (
            <p className="mt-1.5 text-[11px] text-brand-mute">
              Sleeps up to {capacityLimit} (adults + children). Infants &amp;
              pets don&rsquo;t count.
            </p>
          ) : null}
          {ageExtras.lines.length > 0 ? (
            <div className="mt-2 space-y-0.5">
              {ageExtras.lines.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[11px] text-brand-mute"
                >
                  <span>{l.label}</span>
                  <span className="font-medium text-brand-ink">
                    {formatMoney(l.subtotal, currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );

  /* ── Step 2 · Details (contact, add-ons, message) ──────────── */
  const detailsBody = (
    <div className="ck-step space-y-7">
      <header>
        <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
          Step 2 of 3
        </div>
        <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-[28px]">
          Your details &amp; extras
        </h2>
        <p className="mt-1.5 text-sm text-brand-mute">
          Tell your host who&rsquo;s coming and add anything to make the stay
          special.
        </p>
      </header>

      {/* Add-ons */}
      {eligibleAddons.length > 0 ? (
        <section className={cardLabel}>
          <div className={`${sectionHead} flex-wrap`}>
            <div className="min-w-0">
              <div className="font-display font-semibold text-brand-ink">
                Make it extra-special
              </div>
              <div className="mt-0.5 text-xs text-brand-mute">
                Optional add-ons offered by your host.
                {selectedAddonLines.length > 0 ? (
                  <span className="font-medium text-brand-primary">
                    {" "}
                    · {selectedAddonLines.length} selected ·{" "}
                    {formatMoney(addonsTotal, currency)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
              Optional
            </div>
          </div>
          <div className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-5">
            {eligibleAddons.map((a) => {
              const qty = addonQty.get(a.id) ?? 0;
              const checked = qty > 0;
              const lineTotal = checked
                ? computeAddonSubtotal(
                    a.pricingModel,
                    a.unitPrice,
                    qty,
                    effectiveGuests,
                  )
                : 0;
              const stock = a.stockQuantity;
              const soldOut = stock != null && stock <= 0;
              const perNight = isPerNightModel(a.pricingModel);
              const clampOpts = {
                minQuantity: a.minQuantity,
                maxQuantity: a.maxQuantity,
                nights,
                stock: a.stockQuantity,
                allowCustom: a.allowCustomQuantity,
              };
              const canDec =
                clampAddonQuantity(a.pricingModel, qty - 1, clampOpts) < qty;
              const canInc =
                clampAddonQuantity(a.pricingModel, qty + 1, clampOpts) > qty;
              const showStepper = checked && a.allowCustomQuantity;
              return (
                <div
                  key={a.id}
                  className={`flex flex-col overflow-hidden rounded-card border transition ${
                    checked
                      ? "ck-selected border-brand-primary"
                      : "border-brand-line bg-white hover:border-brand-primary/50"
                  } ${soldOut ? "opacity-60" : ""}`}
                >
                  <button
                    type="button"
                    disabled={a.isRequired || isPending || soldOut}
                    onClick={() => toggleAddon(a.id)}
                    className={`flex gap-3 p-3.5 text-left transition ${
                      a.isRequired || soldOut ? "cursor-default" : ""
                    }`}
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
                            {formatMoney(a.unitPrice, currency)}
                          </span>
                          <span className="text-brand-mute">
                            {" "}
                            · {PRICING_LABEL[a.pricingModel]}
                          </span>
                        </div>
                        {checked && lineTotal > 0 ? (
                          <div className="font-mono text-[11px] text-brand-secondary">
                            = {formatMoney(lineTotal, currency)}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {a.isRequired ? (
                          <span className="inline-flex rounded-pill bg-brand-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                            Required
                          </span>
                        ) : null}
                        {soldOut ? (
                          <span className="inline-flex rounded-pill bg-status-cancelled/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-status-cancelled">
                            Sold out
                          </span>
                        ) : stock != null ? (
                          <span className="inline-flex rounded-pill bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-mute">
                            {stock} left
                          </span>
                        ) : null}
                        {checked && !a.allowCustomQuantity && perNight ? (
                          <span className="text-[10px] text-brand-mute">
                            whole stay · {qty} {qty === 1 ? "night" : "nights"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {showStepper ? (
                    <div className="flex items-center justify-between gap-3 border-t border-brand-primary/20 px-3.5 py-2.5">
                      <span className="text-[11px] font-medium text-brand-ink">
                        {perNight ? "For how many nights?" : "Quantity"}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setAddonQuantity(a.id, qty - 1)}
                          disabled={!canDec || isPending}
                          aria-label="Fewer"
                          className="flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line text-brand-ink transition hover:bg-brand-accent disabled:opacity-30"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-brand-ink">
                          {qty}{" "}
                          <span className="text-[10px] font-normal text-brand-mute">
                            {perNight ? "nights" : "units"}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddonQuantity(a.id, qty + 1)}
                          disabled={!canInc || isPending}
                          aria-label="More"
                          className="flex h-7 w-7 items-center justify-center rounded-pill border border-brand-line text-brand-ink transition hover:bg-brand-accent disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Contact details / create account */}
      <section className={cardLabel}>
        <div className="border-b border-brand-line px-5 py-4">
          <div className="font-display font-semibold text-brand-ink">
            {isAuthenticated ? "Contact details" : "Create your guest account"}
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

      {/* Who's coming? — optional per-guest details */}
      {effectiveGuests > 1 ? (
        <section className={cardLabel}>
          <div className={sectionHead}>
            <div>
              <div className="font-display font-semibold text-brand-ink">
                Who&rsquo;s coming?{" "}
                <span className="text-xs font-normal text-brand-mute">
                  (optional)
                </span>
              </div>
              <div className="mt-0.5 text-xs text-brand-mute">
                Add the rest of your party — up to {effectiveGuests - 1} other
                guest{effectiveGuests - 1 === 1 ? "" : "s"}. Each needs a name
                &amp; email so your host can reach them.
              </div>
            </div>
            <button
              type="button"
              onClick={addGuest}
              disabled={party.length >= effectiveGuests - 1}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light/60 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" /> Add guest
            </button>
          </div>
          <div className="space-y-3 p-5">
            {party.length === 0 ? (
              <button
                type="button"
                onClick={addGuest}
                className="flex w-full items-center justify-center gap-2 rounded border-2 border-dashed border-brand-line py-5 text-sm font-medium text-brand-mute transition-colors hover:border-brand-primary hover:bg-brand-light/40 hover:text-brand-secondary"
              >
                <Plus className="h-4 w-4" /> Add a guest&rsquo;s details
              </button>
            ) : (
              party.map((g, i) => (
                <div
                  key={i}
                  className="rounded-card border border-brand-line bg-brand-light/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                      Guest {i + 2}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGuest(i)}
                      aria-label="Remove guest"
                      className="flex h-7 w-7 items-center justify-center rounded text-brand-mute hover:bg-white hover:text-status-cancelled"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input
                      value={g.name}
                      onChange={(e) => updateGuest(i, { name: e.target.value })}
                      placeholder="Full name"
                      maxLength={120}
                      className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                    />
                    <input
                      value={g.email}
                      onChange={(e) =>
                        updateGuest(i, { email: e.target.value })
                      }
                      type="email"
                      placeholder="Email"
                      maxLength={160}
                      className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                    />
                    <input
                      value={g.phone}
                      onChange={(e) =>
                        updateGuest(i, { phone: e.target.value })
                      }
                      placeholder="Phone (optional)"
                      maxLength={40}
                      className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                    />
                  </div>
                </div>
              ))
            )}
            {party.length > 0 && party.length < effectiveGuests - 1 ? (
              <button
                type="button"
                onClick={addGuest}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
              >
                <Plus className="h-4 w-4" /> Add another guest
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Message to host */}
      <section className={cardLabel}>
        <div className="border-b border-brand-line px-5 py-4">
          <div className="font-display font-semibold text-brand-ink">
            Message to host
          </div>
          <div className="mt-0.5 text-xs text-brand-mute">
            Optional — early check-in, dietary needs, anything your host should
            know.
          </div>
        </div>
        <div className="p-5">
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
            placeholder="Hi! We're flying in around 3pm. Could we drop bags before official check-in?"
            className="w-full resize-none rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
          />
          <div className="mt-1 text-right text-[11px] text-brand-mute">
            {(contact.message || "").length} / 1000
          </div>
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
            <ul className="mt-2 space-y-1.5 text-sm text-brand-ink">
              {CANCELLATION_BULLETS[cancellationPolicy].map((b) => (
                <li key={b.text} className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill ${b.dot}`}
                  />
                  {b.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );

  /* ── Step 3 · Payment ──────────────────────────────────────── */
  const paymentBody = (
    <div className="ck-step space-y-7">
      <header>
        <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
          Step 3 of 3
        </div>
        <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-[28px]">
          Choose how you&rsquo;ll pay
        </h2>
        <p className="mt-1.5 text-sm text-brand-mute">
          All payments are processed securely. {brandName} never charges a
          booking fee.
        </p>
      </header>

      {/* Can't-pay guard — nothing is created or charged in these states. */}
      {!canPay ? (
        <div className="flex items-start gap-2.5 rounded-card border border-amber-200 bg-amber-50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-amber-800">
            {paymentMethods.length === 0
              ? "This host hasn’t set up a way to take payment yet. You can’t complete a booking until they connect a card or EFT method."
              : "Your total is R0 — the room you picked may no longer be available for these dates. Nothing has been booked. Go back to choose different dates or another room."}
            <button
              type="button"
              onClick={() => setStep(0)}
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-900 hover:bg-amber-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to dates &amp; rooms
            </button>
          </div>
        </div>
      ) : null}

      {/* Method selector */}
      <section className="space-y-2.5">
        {paymentMethods.map((m) => {
          const on = method === m.id;
          const Icon = m.Icon;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => setMethod(m.id)}
              disabled={isPending}
              className={`flex w-full items-center gap-4 rounded-card border bg-white px-5 py-4 text-left transition ${
                on
                  ? "ck-selected border-brand-primary"
                  : "border-brand-line hover:border-brand-primary/50"
              }`}
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 transition ${
                  on
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-line"
                }`}
              >
                {on ? <span className="h-2 w-2 rounded-pill bg-white" /> : null}
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                  on
                    ? "bg-brand-accent text-brand-primary"
                    : "bg-brand-light text-brand-mute"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-brand-ink">{m.label}</div>
                <div className="mt-0.5 text-xs text-brand-mute">{m.sub}</div>
              </div>
              {m.cards ? (
                <div className="hidden items-center gap-1.5 sm:flex">
                  {m.cards.map((c) => (
                    <CardLogo key={c} kind={c} />
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </section>

      {/* Method body */}
      {method === "paystack" ? (
        <section className={cardLabel}>
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
            <div className="font-display font-semibold text-brand-ink">
              Secure card payment
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-brand-mute">
              <Lock className="h-3 w-3" /> Encrypted with Paystack
            </div>
          </div>
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-brand-ink">
                You&rsquo;ll finish on Paystack
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                When you tap{" "}
                <span className="font-medium text-brand-ink">
                  Pay {formatMoney(total, currency)}
                </span>{" "}
                below, you&rsquo;ll be taken to Paystack&rsquo;s secure page to
                enter your card. {brandName} never sees or stores your card
                number, and you won&rsquo;t be charged a booking fee.
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                {[
                  ["Step 1", "Enter card on Paystack"],
                  ["Step 2", "Payment confirmed instantly"],
                  ["Step 3", "Trip locked · receipt emailed"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded border border-brand-line bg-brand-light/40 p-3"
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                      {k}
                    </div>
                    <div className="mt-1 text-xs font-medium text-brand-ink">
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={cardLabel}>
          <div className="border-b border-brand-line px-5 py-4">
            <div className="font-display font-semibold text-brand-ink">
              Bank transfer details
            </div>
            <div className="mt-0.5 text-xs text-brand-mute">
              Reserve first — we&rsquo;ll then show the host&rsquo;s banking
              details and your reference to complete the transfer.
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-start gap-2.5 rounded border border-amber-200 bg-amber-50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="text-xs leading-relaxed text-amber-800">
                Nothing is booked yet. When you tap reserve, we&rsquo;ll hold
                your dates and show the host&rsquo;s banking details — use the
                exact reference we give you so they can match your transfer.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Trust strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            Icon: Lock,
            t: "Secure payment",
            s: "Encrypted via Paystack.",
          },
          {
            Icon: Percent,
            t: "No booking fees",
            s: `${brandName} never charges guests a fee.`,
          },
          {
            Icon: ShieldCheck,
            t: "Buyer protection",
            s: "Full refund if the host cancels.",
          },
        ].map((x) => (
          <div key={x.t} className={`${cardLabel} p-4`}>
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
              <x.Icon className="h-4 w-4" />
            </div>
            <div className="text-sm font-medium text-brand-ink">{x.t}</div>
            <div className="mt-0.5 text-xs leading-relaxed text-brand-mute">
              {x.s}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const progressPct = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="space-y-5">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes ck-step-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.ck-step{animation:ck-step-in .35s cubic-bezier(.2,.7,.2,1) both;}
.ck-selected{box-shadow:0 0 0 2px #10B981 inset, 0 8px 28px -16px rgba(6,78,59,0.18);}
@keyframes ck-ring{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.35);}70%{box-shadow:0 0 0 10px rgba(16,185,129,0);}}
.ck-pulse{animation:ck-ring 2.2s ease-out infinite;}
@media (prefers-reduced-motion: reduce){.ck-step,.ck-pulse{animation:none!important;}}
`,
        }}
      />

      {/* Progress band */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="h-1 bg-brand-light">
          <div
            className="h-full bg-brand-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="hide-sb flex items-center gap-3 px-4 py-3 md:px-5">
          <span className="hidden shrink-0 font-mono text-[10px] text-brand-mute sm:inline">
            {String(step + 1).padStart(2, "0")}/
            {String(STEPS.length).padStart(2, "0")}
          </span>
          <div className="hide-sb flex flex-1 items-center gap-2 overflow-x-auto md:gap-2.5">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={label} className="flex items-center gap-2 md:gap-2.5">
                  <div className="flex shrink-0 items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-pill text-xs font-semibold ${
                        done
                          ? "bg-brand-primary text-white"
                          : active
                            ? "ck-pulse border-2 border-brand-primary bg-white text-brand-primary"
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
                      } ${!active ? "hidden sm:inline" : ""}`}
                    >
                      {label}
                    </div>
                  </div>
                  {i < STEPS.length - 1 ? (
                    <div
                      className={`h-px w-6 min-w-6 md:w-10 ${
                        i < step ? "bg-brand-primary" : "bg-brand-line"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-[11px] text-brand-mute md:inline-flex">
            <Lock className="h-3.5 w-3.5 text-brand-primary" /> Secure checkout
          </span>
        </div>
      </section>

      <form
        onSubmit={(e) => {
          // The form never charges on submit. Enter on steps 1–2 just advances
          // the wizard; on the payment step it does nothing — the guest must
          // click Pay. Payment is wired to the Pay button's onClick only.
          e.preventDefault();
          if (step !== 2) goNext();
        }}
        className="grid items-start gap-5 lg:grid-cols-[1fr_380px] lg:gap-7"
      >
        {/* ── Left column: the current step ───────────────────────── */}
        <section className="min-w-0 pb-24 lg:pb-0">
          {step === 0 ? roomsBody : step === 1 ? detailsBody : paymentBody}

          {/* Footer actions */}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 text-sm text-brand-mute transition-colors hover:text-brand-ink disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="hidden items-center gap-1.5 text-[11px] text-brand-mute lg:flex">
              {step === 2
                ? "Complete payment from your summary"
                : "Continue from your summary"}
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Legal disclaimer (payment step) */}
          {step === 2 ? (
            <div className="mt-4 max-w-xl text-[11px] leading-relaxed text-brand-mute">
              By tapping{" "}
              <span className="font-medium text-brand-ink">{payLabel}</span>,
              you agree to {brandName}&rsquo;s Terms and the host&rsquo;s house
              rules, and that {brandName} may charge your payment method per the{" "}
              <span className="capitalize">{cancellationPolicy}</span>{" "}
              cancellation policy if you cancel or fail to check in.
            </div>
          ) : null}
        </section>

        {/* ── Right column: sticky summary ────────────────────────── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="relative overflow-hidden rounded-card bg-brand-gradient-dark text-white shadow-peek">
            {/* ambient glow */}
            <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-pill bg-brand-primary/25 blur-3xl" />

            {/* cover */}
            <div className="relative h-36 overflow-hidden">
              {coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-brand-gradient-dark" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/40 to-transparent" />
              {instantBooking ? (
                <span className="absolute left-4 top-3.5 inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-black/35 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                  <Zap className="h-3 w-3 text-emerald-300" /> Instant Book
                </span>
              ) : null}
              <div className="absolute bottom-3 left-4 right-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-200/90">
                  {locationLine
                    ? `${listingTypeLabel} · ${listingCity ?? locationLine}`
                    : listingTypeLabel}
                </div>
                <div className="truncate font-display text-xl font-bold leading-tight text-white">
                  {listingName}
                </div>
              </div>
            </div>

            <div className="relative p-5">
              {/* You're booking with — host attribution */}
              {hostName ? (
                <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 pb-4">
                  {hostAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hostAvatarUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-pill object-cover ring-2 ring-white/15"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-white/10 text-[12px] font-bold text-emerald-200 ring-2 ring-white/15">
                      {hostName.trim().charAt(0).toUpperCase() || "H"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                      You&rsquo;re booking with
                    </div>
                    <div className="truncate text-[13.5px] font-semibold text-white">
                      {hostName}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* date rail */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-card border border-white/10 bg-white/[0.06] p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                    Check-in
                  </div>
                  <div className="mt-0.5 font-display font-bold text-white">
                    {fmtDate(dates.from)}
                  </div>
                </div>
                <div className="flex flex-col items-center px-1 text-emerald-300">
                  <Moon className="h-4 w-4" />
                  <div className="mt-0.5 text-[11px] font-semibold">
                    {nights}n
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                    Check-out
                  </div>
                  <div className="mt-0.5 font-display font-bold text-white">
                    {fmtDate(dates.to)}
                  </div>
                </div>
              </div>

              {/* guests */}
              <div className="mt-3 flex items-center gap-2 text-sm text-white/80">
                <Users className="h-4 w-4 text-white/55" />
                {effectiveGuests} {effectiveGuests === 1 ? "guest" : "guests"}
              </div>

              {/* rooms / whole place */}
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-white/45">
                  {isWhole
                    ? "Whole place"
                    : `${selectedRooms.length} ${
                        selectedRooms.length === 1 ? "room" : "rooms"
                      } selected`}
                </div>
                {isWhole ? (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-white/10 text-emerald-200 ring-1 ring-white/10">
                      <Home className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-white">
                        {listingName}
                      </div>
                      <div className="font-mono text-[10.5px] text-white/45">
                        {formatMoney(basePrice, currency)} × {nights}n
                      </div>
                    </div>
                    <div className="shrink-0 text-[13px] font-semibold text-white">
                      {formatMoney(subtotal, currency)}
                    </div>
                  </div>
                ) : selectedRooms.length === 0 ? (
                  <div className="text-xs italic text-white/50">
                    No rooms selected yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedRooms.map((r) => (
                      <div key={r.id} className="flex items-center gap-3">
                        {r.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.photoUrl}
                            alt=""
                            className="h-9 w-11 shrink-0 rounded-md object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-white/10 text-emerald-200 ring-1 ring-white/10">
                            <BedDouble className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-white">
                            {r.name}
                          </div>
                          <div className="font-mono text-[10.5px] text-white/45">
                            {formatMoney(roomNightly(r), currency)} × {nights}n
                          </div>
                        </div>
                        <div className="shrink-0 text-[13px] font-semibold text-white">
                          {formatMoney(roomNightly(r) * nights, currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* breakdown */}
              <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-white/85">
                    {scope === "rooms" ? "Rooms subtotal" : "Stay subtotal"}
                  </span>
                  <span className="text-white">
                    {formatMoney(subtotal, currency)}
                  </span>
                </div>
                {seasonalNights > 0 || weekendNights > 0 ? (
                  <div className="text-[11px] text-white/45">
                    {[
                      seasonalNights > 0
                        ? `${seasonalNights} season-priced night${seasonalNights === 1 ? "" : "s"}`
                        : null,
                      weekendNights > 0
                        ? `${weekendNights} weekend night${weekendNights === 1 ? "" : "s"}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                ) : null}
                {discountTotal > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300/90">
                      Discount
                      {breakdown?.discount.losKind === "monthly"
                        ? " · monthly stay"
                        : breakdown?.discount.losKind === "weekly"
                          ? " · weekly stay"
                          : breakdown && breakdown.discount.wholeSaving > 0
                            ? " · whole place"
                            : ""}
                    </span>
                    <span className="text-emerald-300">
                      −{formatMoney(discountTotal, currency)}
                    </span>
                  </div>
                ) : null}
                {selectedAddonLines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between"
                  >
                    <span className="min-w-0 truncate pr-2 text-white/65">
                      {line.name}
                    </span>
                    <span className="text-white">
                      {formatMoney(line.subtotal, currency)}
                    </span>
                  </div>
                ))}
                {cleaningTotal > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-white/85">
                      {scope === "rooms" ? "Cleaning fees" : "Cleaning fee"}
                    </span>
                    <span className="text-white">
                      {formatMoney(cleaningTotal, currency)}
                    </span>
                  </div>
                ) : null}
                {couponDiscount > 0 && appliedCoupon ? (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300/90">
                      Coupon · {appliedCoupon.code}
                    </span>
                    <span className="text-emerald-300">
                      −{formatMoney(couponDiscount, currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-white/85">{brandName} service fee</span>
                  <span className="font-medium text-emerald-300">FREE</span>
                </div>
              </div>

              {/* coupon */}
              <div className="mt-4 border-t border-white/10 pt-4">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-emerald-300">
                      Coupon “{appliedCoupon.code}” applied
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-white/60 underline hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) =>
                          setCouponInput(e.target.value.toUpperCase())
                        }
                        placeholder="Coupon code"
                        className="min-w-0 flex-1 rounded bg-white/10 px-3 py-2 text-sm uppercase tracking-wide text-white placeholder-white/40 outline-none focus:bg-white/15"
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={
                          couponPending || !couponInput.trim() || !datesValid
                        }
                        className="rounded bg-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/25 disabled:opacity-50"
                      >
                        {couponPending ? "…" : "Apply"}
                      </button>
                    </div>
                    {couponError ? (
                      <p className="mt-1 text-[11px] text-rose-300">
                        {couponError}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* total */}
              <div className="mt-4 flex items-end justify-between border-t border-white/15 pt-4">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                    Total · {currency}
                  </div>
                  <div className="text-[11px] text-white/45">
                    incl. all fees · no booking fee
                  </div>
                </div>
                <div className="font-display text-[28px] font-extrabold leading-none text-white">
                  {formatMoney(total, currency)}
                </div>
              </div>

              {/* CTA — travels with the card (desktop) */}
              {step === 2 ? (
                <button
                  type="button"
                  onClick={pay}
                  disabled={isPending || !canPay}
                  className="mt-4 hidden w-full items-center justify-center gap-2 rounded bg-brand-primary py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:inline-flex"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {payLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === 0 && step0Blocked}
                  className="mt-4 hidden w-full items-center justify-center gap-2 rounded bg-brand-primary py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:inline-flex"
                >
                  {step === 0 ? "Continue to details" : "Continue to payment"}{" "}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {/* Why you can't continue yet (rooms step) */}
              {step === 0 && step0Reason ? (
                <div className="mt-2.5 flex items-start gap-1.5 rounded border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-100">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                  {step0Reason}
                </div>
              ) : null}

              {/* refund / safety strip */}
              <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/45">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                {CANCELLATION_BULLETS[cancellationPolicy][0].text}
              </div>

              {step === 2 ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/45">
                  <Mail className="h-3 w-3" />
                  {method === "eft"
                    ? "You’ll get the host’s banking details to complete payment."
                    : isAuthenticated
                      ? "You won’t be charged until payment completes."
                      : "We’ll create your guest account, then open secure checkout."}
                </p>
              ) : null}
            </div>
          </div>
        </aside>

        {/* ── Mobile sticky action bar ────────────────────────────── */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          {step === 0 && step0Reason ? (
            <div className="mx-auto mb-2 flex max-w-3xl items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] leading-snug text-amber-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              {step0Reason}
            </div>
          ) : null}
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display text-base font-bold text-brand-ink">
                {formatMoney(total, currency)}
              </div>
              <div className="truncate text-[11px] text-brand-mute">
                {nights} {nights === 1 ? "night" : "nights"} · {effectiveGuests}{" "}
                {effectiveGuests === 1 ? "guest" : "guests"}
              </div>
            </div>
            {step === 2 ? (
              <button
                type="button"
                onClick={pay}
                disabled={isPending || !canPay}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {isPending ? "Working…" : method === "eft" ? "Reserve" : "Pay"}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={step === 0 && step0Blocked}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card brand marks (echoes the design's payment-method row)                  */
/* -------------------------------------------------------------------------- */
function CardLogo({ kind }: { kind: "visa" | "mc" }) {
  if (kind === "visa") {
    return (
      <div className="flex h-5 items-center rounded-sm bg-[#1A1F71] px-1.5 font-mono text-[10px] font-bold text-white">
        VISA
      </div>
    );
  }
  return (
    <div className="flex h-5 items-center gap-0.5 rounded-sm border border-brand-line bg-white px-1.5">
      <span className="h-3 w-3 rounded-pill bg-[#EB001B]" />
      <span className="-ml-1.5 h-3 w-3 rounded-pill bg-[#F79E1B] mix-blend-multiply" />
    </div>
  );
}
