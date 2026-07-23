"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { commerceParams, firePixelEvent } from "@/lib/analytics/pixel";
import { nightsBetween } from "@/lib/pricing";

import {
  PRICING_LABEL,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";
import {
  SectionShell,
  SectionHeading,
  Muted,
  Card,
} from "@/components/site/sections/_shared";
import {
  TurnstileWidget,
  turnstileEnabled,
} from "@/components/site/TurnstileWidget";
import { ThemedDateRange } from "@/components/site/ThemedDateRange";
import { SiteLoadingOverlay } from "@/components/site/SiteLoadingOverlay";
import { Money } from "@/components/currency/Money";
import { useCurrency } from "@/components/currency/CurrencyProvider";

// A browsing ESTIMATE of the total in the guest's chosen display currency, shown
// under the (always native-currency) Total when they've switched currency. Purely
// informational — the charge is always the host's settlement currency, so the
// line spells that out. Renders nothing while the display matches the charge
// currency (no conversion to show). Uses <Money>, which only ever converts a ZAR
// base and marks it "≈"; a non-ZAR settlement amount renders natively.
function TotalEstimate({
  total,
  chargeCurrency,
}: {
  total: number | null;
  chargeCurrency: string;
}) {
  const { enabled, currency: display } = useCurrency();
  if (!enabled || total == null || display === chargeCurrency) return null;
  return (
    <p className="mt-1 text-xs" style={{ color: "var(--site-mute)" }}>
      <Money amount={total} currency={chargeCurrency} /> — estimate only;
      you&apos;re charged in {chargeCurrency}.
    </p>
  );
}
import { SiteThemeModal } from "@/components/site/SiteThemeModal";

export type CheckoutRoom = {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  maxGuests: number;
  minGuests: number;
  minNights: number;
};

export type CheckoutAddon = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  minQuantity: number;
  maxQuantity: number | null;
  allowCustom: boolean;
  stock: number | null;
  isRequired: boolean;
  /** null = property-wide; otherwise shown only when one of these rooms is picked. */
  roomIds: string[] | null;
};

type Scope = "whole_listing" | "rooms";

const isPerNight = (m: PricingModel) =>
  m === "per_night" || m === "per_guest_per_night";

// Fields read the host's saved `--el-field-*` styling (set on the checkout page's
// `booking_form` node, applied by BookingStyleOverlay on the live route) and fall
// back to the theme tokens when unset — so styling the "Fields" element in the
// builder restyles the real inputs live, with zero change when the host hasn't
// touched it. (Builder V3 Group 1 — close the live styling gap.)
const fieldStyle: CSSProperties = {
  background: "var(--el-field-bg, var(--site-bg))",
  // Full border shorthand from --el-field-bd (elementVarsCss emits `Npx solid C`);
  // falls back to a theme-line border nudged toward the ink so fields stay clearly
  // defined on BOTH light and dark themes (a bare --site-line is nearly invisible
  // on the dark Ebony/Sabela surface). Inline wins over the `border` utility below.
  border:
    "var(--el-field-bd, 1px solid color-mix(in srgb, var(--site-line), var(--site-ink) 16%))",
  color: "var(--el-field-fg, var(--site-ink))",
  borderRadius: "var(--el-field-radius, var(--site-radius))",
};
// `siteco-field` lets the one <style> block below own placeholder + focus/hover
// states (readable muted placeholder, a bold accent focus ring) that inline
// styles can't express — modern, legible, attention-grabbing on every theme.
const inputCls = "siteco-field w-full border px-3 py-2.5 text-sm outline-none";

// On DARK themes (Sabela/Ebony) a card at bare --site-surface sits almost on top
// of the page ground and disappears. Lift it a warm step toward the ink so the
// form/summary cards read as a distinct, modern "lighter brown" panel — while the
// inputs (kept at --site-bg) become clean inset wells. Light themes (Marmalade's
// crisp white cards) are left exactly as they are.
const ELEVATED_DARK_SURFACE =
  "color-mix(in srgb, var(--site-surface), var(--site-ink) 8%)";
const cardSurfaceFor = (surfaceDark: boolean) =>
  surfaceDark ? ELEVATED_DARK_SURFACE : "var(--site-surface)";

function money(total: number | null, currency: string) {
  if (total == null) return null;
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(total);
  } catch {
    return `${currency} ${total}`;
  }
}

// Deterministic date formatting for the offer card (no locale → no hydration drift).
const OFFER_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function fmtOfferDate(iso?: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return `${Number(m[3])} ${OFFER_MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
function fmtOfferRange(a?: string | null, b?: string | null): string | null {
  const s = fmtOfferDate(a);
  const e = fmtOfferDate(b);
  if (s && e) return `${s} – ${e}`;
  return s || e || null;
}
function offerNightsLabel(
  min?: number | null,
  max?: number | null,
): string | null {
  if (min && max && min !== max) return `${min}–${max} nights`;
  const n = min || max;
  return n ? `${n} night${n === 1 ? "" : "s"}` : null;
}

/**
 * On-site checkout form (Phase 6B/c) — themed with --site-* so it lives on the
 * host's own domain. Collects the stay, party and contact details, shows a
 * SERVER-RECALCULATED running total (POST /api/site-booking-quote) and, on
 * submit, creates the booking + starts payment (POST /api/site-booking) before
 * redirecting to the host's Paystack page (card) or the on-site thank-you (EFT).
 * Nothing about money is computed or trusted client-side.
 */
export function SiteCheckoutForm({
  websiteId,
  propertyId,
  propertyName,
  currency,
  maxGuests,
  basePrice,
  bookingMode,
  rooms,
  addons,
  cardAvailable,
  eftAvailable,
  paypalAvailable,
  cancellation,
  initial,
  special,
  preview = false,
  surfaceDark = false,
}: {
  websiteId: string;
  propertyId: string;
  propertyName: string;
  currency: string;
  maxGuests: number;
  basePrice: number | null;
  bookingMode: string;
  rooms: CheckoutRoom[];
  addons: CheckoutAddon[];
  cardAvailable: boolean;
  eftAvailable: boolean;
  paypalAvailable: boolean;
  cancellation: { title: string; note: string } | null;
  initial: {
    from: string;
    to: string;
    guests: number;
    roomId: string | null;
    scope: Scope | null;
  };
  /** Set when booking a SPECIAL (offer): the checkout is locked to it and the
   *  server prices at the offer rate + redeems it. Total shown here is the
   *  server-computed offer total (advisory; the create call re-prices). */
  special?: {
    id: string;
    title: string;
    total: number;
    /** Per-night offer rate (null for flat offers) — lets the running total track
     *  the guest's chosen nights on a flexible per-night offer. */
    perNight?: number | null;
    currency: string;
    dateMode: "fixed" | "flexible";
    savingsLabel?: string | null;
    /** Offer's room (null = whole-listing offer). Locks the room selection. */
    roomId?: string | null;
    description?: string | null;
    // Offer terms shown on the "Offer applied" card so the guest knows how to claim it.
    windowStart?: string | null;
    windowEnd?: string | null;
    fixedCheckIn?: string | null;
    fixedCheckOut?: string | null;
    minNights?: number | null;
    maxNights?: number | null;
    remaining?: number | null;
    bookBy?: string | null;
  };
  /** Builder-only: render the real form as an INERT preview — no quote/submit
   *  network, no Turnstile, pay button disabled. The builder's `booking_form`
   *  system-page element renders this so the host styles the ACTUAL checkout;
   *  the live /book route omits it (default false → unchanged behaviour). */
  preview?: boolean;
  /** True when the active theme's surface is dark → elevate the cards to a lighter
   *  warm panel so they stand out (computed server-side via siteSurfaceIsDark). */
  surfaceDark?: boolean;
}) {
  const cardSurface = cardSurfaceFor(surfaceDark);
  // Selectable rows (rooms + add-ons) sit ON the form card. On dark themes lift
  // them a further step so they read as distinct, tappable cards instead of
  // blending into the panel; give them a clearer border too. Light themes keep
  // the plain surface + hairline line.
  const rowCardBg = surfaceDark
    ? "color-mix(in srgb, var(--site-surface), var(--site-ink) 16%)"
    : "var(--site-surface)";
  const rowCardBorder = surfaceDark
    ? "color-mix(in srgb, var(--site-line), var(--site-ink) 28%)"
    : "var(--site-line)";
  // The date-range field text a touch deeper/softer (founder request) — a bone
  // pulled slightly toward the mute so it reads calmer than full-bright ink.
  const dateInk = "color-mix(in srgb, var(--site-ink), var(--site-mute) 28%)";
  const canWhole = bookingMode !== "rooms_only" && basePrice != null;
  const canRooms = rooms.length > 0;

  // A special LOCKS what's bookable: a room-scoped offer pins that one room; a
  // whole-listing offer pins the whole place. The guest can't switch either.
  const lockedRoomId = special?.roomId ?? null;
  const lockedWhole = !!special && !special.roomId;
  // A fixed-date offer pins the exact stay dates — show them read-only (like the
  // compulsory add-ons), so the guest can't change them.
  const datesLocked = special?.dateMode === "fixed";

  const [scope, setScope] = useState<Scope>(
    lockedRoomId
      ? "rooms"
      : lockedWhole
        ? "whole_listing"
        : (initial.scope ?? (canRooms ? "rooms" : "whole_listing")),
  );

  // Per-room selected guest counts (rooms scope). Seed the pre-selected room with
  // the guest count carried from the dock/URL (clamped to the room's min/max), so
  // a "2 guests" choice on the room page isn't silently reset to the minimum.
  const [roomGuests, setRoomGuests] = useState<Record<string, number>>(() => {
    if (initial.roomId) {
      const r = rooms.find((x) => x.id === initial.roomId);
      if (r) {
        const want = initial.guests || r.minGuests || 1;
        return { [r.id]: Math.min(r.maxGuests, Math.max(r.minGuests, want)) };
      }
    }
    return {};
  });

  const [checkIn, setCheckIn] = useState(initial.from);
  const [checkOut, setCheckOut] = useState(initial.to);
  const [wholeGuests, setWholeGuests] = useState(initial.guests);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  // Party manifest — details for the OTHER guests (the primary contact above is
  // guest #1). Optional; only names that are filled are submitted.
  const [party, setParty] = useState<
    { name: string; email: string; phone: string }[]
  >([]);

  // On a special, PRE-SELECT everything the offer bundles (its add-ons) so the
  // checkout reflects exactly what's included — the guest can still adjust optional
  // ones. Required add-ons are added server-side regardless.
  const [addonQty, setAddonQty] = useState<Record<string, number>>(() => {
    if (!special) return {};
    const init: Record<string, number> = {};
    for (const a of addons) init[a.id] = Math.max(1, a.minQuantity || 1);
    return init;
  });
  const [coupon, setCoupon] = useState("");

  const [method, setMethod] = useState<"paystack" | "eft" | "paypal">(
    cardAvailable ? "paystack" : paypalAvailable ? "paypal" : "eft",
  );

  // Meta AddPaymentInfo — fires once, the first time the guest picks a payment
  // method. On a host micro-site the only pixel loaded is the host's own, so
  // this reaches the HOST's pixel (best-practice commerce params + eventID).
  const apiFiredRef = useRef(false);
  function selectMethod(m: "paystack" | "eft" | "paypal") {
    setMethod(m);
    if (apiFiredRef.current) return;
    apiFiredRef.current = true;
    firePixelEvent("AddPaymentInfo", {
      ...commerceParams({
        contentIds: [propertyId],
        contentName: propertyName,
        currency,
        ...(quote?.total != null ? { value: quote.total } : {}),
      }),
      payment_method: m,
    });
  }
  const [ack, setAck] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsNonce, setTsNonce] = useState(0);

  const [quote, setQuote] = useState<{
    available: boolean;
    total: number | null;
    nights: number;
    couponApplied: boolean;
  } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedRoomIds = useMemo(
    () => Object.keys(roomGuests).filter((id) => roomGuests[id] > 0),
    [roomGuests],
  );

  const guests =
    scope === "rooms"
      ? selectedRoomIds.reduce((sum, id) => sum + (roomGuests[id] || 0), 0)
      : wholeGuests;

  const datesValid = Boolean(checkIn && checkOut && checkOut > checkIn);
  const nights = useMemo(() => {
    if (!datesValid) return 0;
    return Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
    );
  }, [checkIn, checkOut, datesValid]);

  // Is the special still valid for the CURRENTLY-chosen dates? A flexible offer is
  // only active while the stay sits inside its window; picking dates outside the
  // window deactivates the offer (normal prices apply) and we flag it in the UI.
  // A fixed-date offer can't be changed, so it's always active.
  const specialActive = useMemo(() => {
    if (!special) return false;
    if (special.dateMode === "fixed") return true;
    if (!datesValid) return true; // no dates chosen yet — don't warn prematurely
    const ws = special.windowStart;
    const we = special.windowEnd;
    if (!ws || !we) return true;
    return checkIn >= ws && checkOut <= we;
  }, [special, datesValid, checkIn, checkOut]);
  // True only when a special is set but the chosen dates fall outside its range.
  const specialOutOfRange = Boolean(special) && !specialActive;

  // Add-ons available for the current selection (property-wide, or scoped to a
  // selected room). Required ones are always shown as "included".
  const visibleAddons = useMemo(
    () =>
      addons.filter(
        (a) =>
          a.roomIds == null ||
          (scope === "rooms" &&
            a.roomIds.some((rid) => selectedRoomIds.includes(rid))),
      ),
    [addons, scope, selectedRoomIds],
  );

  // Optional add-ons the guest picked (required ones are added server-side).
  const selectedAddons = useMemo(
    () =>
      visibleAddons
        .filter((a) => !a.isRequired && (addonQty[a.id] ?? 0) > 0)
        .map((a) => ({ addon_id: a.id, quantity: addonQty[a.id] })),
    [visibleAddons, addonQty],
  );

  // Stable dep keys so the quote effect re-runs on selection changes.
  const roomGuestsKey = JSON.stringify(roomGuests);
  const selectedAddonsKey = JSON.stringify(selectedAddons);

  const selectionValid =
    scope === "rooms" ? selectedRoomIds.length > 0 : canWhole;
  const canQuote = datesValid && selectionValid && guests > 0;

  // Live, server-recalculated quote (debounced).
  useEffect(() => {
    // Builder preview: never hit the quote API. Show a static demo total so the
    // summary reads like a real booking (the host is styling, not pricing).
    if (preview) {
      setQuote({
        available: true,
        total: 3900,
        nights: 3,
        couponApplied: false,
      });
      return;
    }
    // SPECIAL mode: the offer price is fixed by the offer, not the room quote —
    // show the server-computed offer total (the create call re-prices + redeems).
    // But only while the offer is ACTIVE for the chosen dates; if the guest moved
    // the dates outside the offer window, fall through to the normal room quote.
    if (special && specialActive) {
      const n = nightsBetween(checkIn, checkOut) || 1;
      setQuote({
        available: true,
        total: special.perNight != null ? special.perNight * n : special.total,
        nights: n,
        couponApplied: false,
      });
      return;
    }
    if (!canQuote) {
      setQuote(null);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      setQuoting(true);
      fetch("/api/site-booking-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          property_id: propertyId,
          scope,
          room_ids: scope === "rooms" ? selectedRoomIds : undefined,
          room_guests:
            scope === "rooms"
              ? selectedRoomIds.map((id) => ({
                  room_id: id,
                  guests: roomGuests[id],
                }))
              : [],
          check_in: checkIn,
          check_out: checkOut,
          guests,
          children,
          infants,
          pets,
          selected_addons: selectedAddons,
          coupon_code: coupon.trim() || undefined,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!active) return;
          if (j.ok)
            setQuote({
              available: j.available,
              total: j.total,
              nights: j.nights,
              couponApplied: j.couponApplied,
            });
          else setQuote(null);
        })
        .catch(() => active && setQuote(null))
        .finally(() => active && setQuoting(false));
    }, 500);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preview,
    canQuote,
    scope,
    checkIn,
    checkOut,
    guests,
    children,
    infants,
    pets,
    roomGuestsKey,
    selectedAddonsKey,
    coupon,
    special,
    specialActive,
  ]);

  function toggleRoom(r: CheckoutRoom) {
    setRoomGuests((prev) => {
      const next = { ...prev };
      if (next[r.id] > 0) delete next[r.id];
      else next[r.id] = Math.max(1, r.minGuests);
      return next;
    });
  }

  function toggleAddon(a: CheckoutAddon) {
    setAddonQty((prev) => {
      const next = { ...prev };
      if ((next[a.id] ?? 0) > 0) {
        delete next[a.id];
      } else {
        next[a.id] = isPerNight(a.pricingModel)
          ? Math.max(a.minQuantity, nights || 1)
          : Math.max(a.minQuantity, 1);
      }
      return next;
    });
  }

  // Party manifest: one slot per additional guest beyond the primary contact.
  const partySlots = Math.max(0, guests - 1);
  function updateParty(i: number, patch: Partial<(typeof party)[number]>) {
    setParty((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push({ name: "", email: "", phone: "" });
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }
  const additionalGuests = party
    .slice(0, partySlots)
    .map((g) => ({
      name: g.name.trim(),
      email: g.email.trim() || undefined,
      phone: g.phone.trim() || undefined,
    }))
    .filter((g) => g.name.length > 0);

  const formInvalid =
    !canQuote ||
    // Don't let the guest pay until the stay is confirmed available AND priced —
    // otherwise they'd fill everything, pay, and bounce at the booking step.
    !quote ||
    !quote.available ||
    quote.total == null ||
    !name.trim() ||
    !email.trim() ||
    !ack ||
    (!cardAvailable && !eftAvailable && !paypalAvailable) ||
    (turnstileEnabled() && !tsToken);

  async function onSubmit() {
    if (formInvalid || submitting) return;
    setSubmitting(true);
    setError("");

    const u = new URL(window.location.href);
    const siteParam = u.searchParams.get("site");
    let returnPath = u.pathname.replace(/\/$/, "") + "/thank-you";
    if (siteParam) returnPath += `?site=${encodeURIComponent(siteParam)}`;

    try {
      const res = await fetch("/api/site-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          property_id: propertyId,
          // A special routes to the offer path server-side (offer-rate + redemption).
          // Only claim the offer when its dates still qualify; out-of-range → a
          // normal booking at normal prices (the server also re-validates).
          special_id: special && specialActive ? special.id : undefined,
          scope,
          room_ids: scope === "rooms" ? selectedRoomIds : undefined,
          room_guests:
            scope === "rooms"
              ? selectedRoomIds.map((id) => ({
                  room_id: id,
                  guests: roomGuests[id],
                }))
              : undefined,
          check_in: checkIn,
          check_out: checkOut,
          guests,
          children,
          infants,
          pets,
          selected_addons: selectedAddons,
          coupon_code: coupon.trim() || undefined,
          payment_method: method,
          guest_name: name.trim(),
          guest_email: email.trim(),
          guest_phone: phone.trim() || undefined,
          special_requests: requests.trim() || undefined,
          additional_guests: additionalGuests,
          policy_acknowledged: true,
          return_path: returnPath,
          ts: tsToken,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; redirectTo: string }
        | { ok: false; error: string };
      if (json.ok) {
        window.location.href = json.redirectTo;
      } else {
        setError(json.error);
        setSubmitting(false);
        setTsNonce((n) => n + 1); // refresh the single-use token for a retry
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setSubmitting(false);
      setTsNonce((n) => n + 1);
    }
  }

  if (!canWhole && !canRooms) {
    return (
      <SectionShell width="narrow">
        <Card className="p-8 text-center">
          <Muted>This property isn’t accepting online bookings yet.</Muted>
        </Card>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      {/* Field polish (theme-safe, all themes): a readable MUTED placeholder that
          reads distinctly from typed ink, a bold gold/accent focus ring so the
          active field is obvious, and a hover lift on the border — so the form is
          modern, legible and clearly interactive on dark themes (Sabela/Ebony)
          where a bare field recedes into the surface. */}
      <style>{`
        .siteco-field::placeholder{color:var(--site-mute);opacity:1;}
        .siteco-field:focus{
          border-color:var(--site-accent) !important;
          box-shadow:0 0 0 3px color-mix(in srgb, var(--site-accent) 22%, transparent);
        }
        .siteco-field:hover:not(:focus){
          border-color:color-mix(in srgb, var(--site-line), var(--site-ink) 34%);
        }
      `}</style>
      <SiteLoadingOverlay
        show={submitting}
        message={
          method === "eft"
            ? "Reserving your stay…"
            : "Taking you to secure payment…"
        }
        sub={
          method === "eft"
            ? "Fetching your booking & payment details."
            : "Please don’t close this page."
        }
      />
      <SectionHeading
        className="mb-2"
        style={{
          color: "var(--el-title-fg, var(--site-ink))",
          fontSize: "var(--el-title-size, var(--site-h2))",
          fontWeight:
            "var(--el-title-weight, var(--site-weight-heading))" as unknown as number,
        }}
      >
        Book {propertyName}
      </SectionHeading>
      <Muted className="mb-8 text-center text-base">
        Reserve your stay directly with {propertyName}.
      </Muted>

      {special
        ? (() => {
            const fixed = special.dateMode === "fixed";
            const validRange = fixed
              ? fmtOfferRange(special.fixedCheckIn, special.fixedCheckOut)
              : fmtOfferRange(special.windowStart, special.windowEnd);
            const nights = offerNightsLabel(
              special.minNights,
              special.maxNights,
            );
            const bookBy = fmtOfferDate(special.bookBy);
            const facts: { label: string; value: string }[] = [];
            if (validRange)
              facts.push({
                label: fixed ? "Stay dates" : "Valid",
                value: validRange,
              });
            if (nights) facts.push({ label: "Length", value: nights });
            if (special.remaining != null)
              facts.push({
                label: "Availability",
                value:
                  special.remaining <= 0
                    ? "Sold out"
                    : `${special.remaining} left`,
              });
            if (bookBy) facts.push({ label: "Book by", value: bookBy });
            return (
              <div
                style={{
                  background:
                    "var(--site-soft, color-mix(in srgb, var(--site-accent) 10%, var(--site-bg)))",
                  borderColor: "var(--site-accent)",
                  borderRadius: "var(--site-radius)",
                }}
                className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-2 border px-5 py-4 text-center"
              >
                <span
                  style={{
                    color: specialOutOfRange ? "#be123c" : "var(--site-accent)",
                  }}
                  className="text-xs font-bold uppercase tracking-[0.14em]"
                >
                  {specialOutOfRange
                    ? "Offer not active for these dates"
                    : `Offer applied${
                        special.savingsLabel ? ` · ${special.savingsLabel}` : ""
                      }`}
                </span>
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="text-lg font-semibold"
                >
                  {special.title}
                </span>
                {special.description ? (
                  <span
                    style={{ color: "var(--site-mute)" }}
                    className="max-w-prose text-sm"
                  >
                    {special.description}
                  </span>
                ) : null}
                {facts.length > 0 ? (
                  <div className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm">
                    {facts.map((f) => (
                      <span key={f.label} style={{ color: "var(--site-ink)" }}>
                        <span
                          style={{ color: "var(--site-mute)" }}
                          className="uppercase tracking-wide"
                        >
                          {f.label}:
                        </span>{" "}
                        <span className="font-semibold">{f.value}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                {specialOutOfRange ? (
                  <div
                    style={{
                      background: "var(--site-bg)",
                      borderColor: "#e11d48",
                      color: "#be123c",
                      borderRadius: "var(--site-radius)",
                    }}
                    className="mt-1 w-full border px-4 py-2.5 text-sm font-medium"
                  >
                    ⚠ This offer isn’t active for your chosen dates — you’ll be
                    charged normal prices.{" "}
                    {validRange
                      ? `Pick dates inside ${validRange} to use the offer.`
                      : "Pick dates inside the offer window to use it."}
                  </div>
                ) : (
                  <span
                    style={{ color: "var(--site-mute)" }}
                    className="text-sm"
                  >
                    {fixed
                      ? "Your stay dates are set below."
                      : validRange
                        ? "Pick your check-in and check-out inside the valid window above."
                        : "Pick your dates above."}{" "}
                    The offer rate is applied automatically — nothing changes at
                    payment.
                  </span>
                )}
              </div>
            );
          })()
        : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Form ── */}
        <Card className="p-6" style={{ background: cardSurface }}>
          <div className="space-y-6">
            {/* Dates — the same themed calendar as the booking form/dock. On a
                fixed-date offer they're LOCKED to the offer's dates (read-only). */}
            <Group title="Your dates">
              {datesLocked ? (
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["Check-in", checkIn],
                      ["Check-out", checkOut],
                    ] as [string, string][]
                  ).map(([lbl, val]) => (
                    <div
                      key={lbl}
                      style={{ ...fieldStyle, opacity: 0.9 }}
                      className="flex flex-col gap-0.5 border px-3 py-2"
                    >
                      <span
                        style={{ color: "var(--site-mute)" }}
                        className="text-[10px] font-semibold uppercase tracking-wide"
                      >
                        {lbl}
                      </span>
                      <span
                        style={{ color: "var(--site-ink)" }}
                        className="text-sm font-medium"
                      >
                        {fmtOfferDate(val) ?? "—"}
                      </span>
                    </div>
                  ))}
                  <p
                    style={{ color: "var(--site-accent)" }}
                    className="col-span-2 text-xs font-medium"
                  >
                    Offer dates — set by this special, and locked.
                  </p>
                </div>
              ) : (
                <div
                  // Highlight the date field when a special is set but the dates
                  // now fall outside its range, so the guest sees WHERE to fix it.
                  style={
                    specialOutOfRange
                      ? {
                          boxShadow: "0 0 0 2px #e11d48",
                          borderRadius: "var(--site-radius)",
                        }
                      : undefined
                  }
                  className={
                    specialOutOfRange ? "rounded-[var(--site-radius)]" : ""
                  }
                >
                  <ThemedDateRange
                    from={checkIn}
                    to={checkOut}
                    onChange={(f, t) => {
                      setCheckIn(f);
                      setCheckOut(t);
                    }}
                    accent="var(--site-accent)"
                    ink={dateInk}
                    mute="var(--site-mute)"
                    line="var(--site-line)"
                    surface="var(--site-surface)"
                    radius="var(--site-radius)"
                  />
                  {specialOutOfRange ? (
                    <p
                      style={{ color: "#be123c" }}
                      className="mt-1.5 text-xs font-medium"
                    >
                      These dates are outside the offer — normal prices apply.
                    </p>
                  ) : null}
                </div>
              )}
            </Group>

            {/* What to book — hidden on a special (the offer pins the scope). */}
            {canWhole && canRooms && !special ? (
              <div className="flex gap-2">
                <ScopeTab
                  active={scope === "rooms"}
                  onClick={() => setScope("rooms")}
                >
                  Choose rooms
                </ScopeTab>
                <ScopeTab
                  active={scope === "whole_listing"}
                  onClick={() => setScope("whole_listing")}
                >
                  Whole place
                </ScopeTab>
              </div>
            ) : null}

            {scope === "rooms" ? (
              <Group title={lockedRoomId ? "Your room" : "Rooms"}>
                <div className="space-y-2">
                  {(lockedRoomId
                    ? rooms.filter((r) => r.id === lockedRoomId)
                    : rooms
                  ).map((r) => {
                    // On a room-scoped offer the room is fixed: always selected,
                    // and the checkbox is locked so it can't be changed/removed.
                    const sel = !!lockedRoomId || roomGuests[r.id] > 0;
                    return (
                      <div
                        key={r.id}
                        style={{
                          background: rowCardBg,
                          borderColor: rowCardBorder,
                          borderRadius: "var(--site-radius)",
                        }}
                        className="flex items-center justify-between gap-3 border p-3"
                      >
                        <label className="flex flex-1 items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={sel}
                            disabled={!!lockedRoomId}
                            onChange={() => toggleRoom(r)}
                            className="h-4 w-4"
                          />
                          <span>
                            <span
                              style={{ color: "var(--site-ink)" }}
                              className="text-sm font-medium"
                            >
                              {r.name}
                            </span>
                            {lockedRoomId ? (
                              <span
                                style={{ color: "var(--site-accent)" }}
                                className="ml-2 text-xs font-semibold"
                              >
                                Included in this offer
                              </span>
                            ) : r.price != null ? (
                              <span
                                style={{ color: "var(--site-mute)" }}
                                className="ml-2 text-xs"
                              >
                                from {money(r.price, r.currency)} / night
                              </span>
                            ) : null}
                          </span>
                        </label>
                        {sel ? (
                          <select
                            value={roomGuests[r.id]}
                            onChange={(e) =>
                              setRoomGuests((p) => ({
                                ...p,
                                [r.id]: Number(e.target.value),
                              }))
                            }
                            style={fieldStyle}
                            className="border px-2 py-1.5 text-sm outline-none"
                            aria-label={`Guests in ${r.name}`}
                          >
                            {Array.from(
                              { length: r.maxGuests },
                              (_, i) => i + 1,
                            ).map((n) => (
                              <option key={n} value={n}>
                                {n} {n === 1 ? "guest" : "guests"}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Group>
            ) : (
              <Group title="Guests">
                <Labelled label="Guests">
                  <select
                    value={wholeGuests}
                    onChange={(e) => setWholeGuests(Number(e.target.value))}
                    style={fieldStyle}
                    className={inputCls}
                  >
                    {Array.from({ length: maxGuests }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "guest" : "guests"}
                        </option>
                      ),
                    )}
                  </select>
                </Labelled>
              </Group>
            )}

            {/* Party extras */}
            <Group title="Anyone else?">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stepper
                  label="Children"
                  value={children}
                  onChange={setChildren}
                />
                <Stepper
                  label="Infants"
                  value={infants}
                  onChange={setInfants}
                />
                <Stepper label="Pets" value={pets} onChange={setPets} />
              </div>
            </Group>

            {/* Add-ons — rich cards (image, description, price, qty stepper) */}
            {visibleAddons.length > 0 ? (
              <Group title="Add extras">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {visibleAddons.map((a) => {
                    const on = a.isRequired || (addonQty[a.id] ?? 0) > 0;
                    return (
                      <div
                        key={a.id}
                        style={{
                          // Add-on cards read the host's `--el-addon-*` styling
                          // (Builder V3 Group 1); the selected state keeps the
                          // accent highlight so the picker still reads clearly.
                          background: `var(--el-addon-bg, ${rowCardBg})`,
                          border: on
                            ? "1px solid var(--site-accent)"
                            : `var(--el-addon-bd, 1px solid ${rowCardBorder})`,
                          borderRadius:
                            "var(--el-addon-radius, var(--site-radius))",
                        }}
                        className="flex flex-col border p-3 transition"
                      >
                        <div className="flex items-start gap-3">
                          {a.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.imageUrl}
                              alt=""
                              style={{ borderRadius: "var(--site-radius)" }}
                              className="h-14 w-14 shrink-0 object-cover"
                            />
                          ) : null}
                          <label className="flex flex-1 cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={a.isRequired}
                              onChange={() => toggleAddon(a)}
                              className="mt-0.5 h-4 w-4"
                            />
                            <span className="min-w-0">
                              <span
                                style={{ color: "var(--site-ink)" }}
                                className="block text-sm font-semibold"
                              >
                                {a.name}
                                {a.isRequired ? (
                                  <span
                                    style={{ color: "var(--site-mute)" }}
                                    className="ml-1.5 text-xs font-normal"
                                  >
                                    (included)
                                  </span>
                                ) : null}
                              </span>
                              {a.description ? (
                                <span
                                  style={{ color: "var(--site-mute)" }}
                                  className="mt-0.5 line-clamp-2 block text-xs leading-snug"
                                >
                                  {a.description}
                                </span>
                              ) : null}
                              <span
                                style={{ color: "var(--site-ink)" }}
                                className="mt-1 block text-xs font-medium"
                              >
                                {money(a.unitPrice, a.currency)}{" "}
                                <span
                                  style={{ color: "var(--site-mute)" }}
                                  className="font-normal"
                                >
                                  {PRICING_LABEL[a.pricingModel]}
                                </span>
                              </span>
                            </span>
                          </label>
                        </div>
                        {on && !a.isRequired && a.allowCustom ? (
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <span
                              style={{ color: "var(--site-mute)" }}
                              className="text-xs"
                            >
                              Qty
                            </span>
                            <input
                              type="number"
                              min={Math.max(1, a.minQuantity)}
                              max={a.maxQuantity ?? undefined}
                              value={addonQty[a.id] ?? a.minQuantity}
                              onChange={(e) =>
                                setAddonQty((p) => ({
                                  ...p,
                                  [a.id]: Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  ),
                                }))
                              }
                              style={fieldStyle}
                              className="w-16 border px-2 py-1.5 text-sm outline-none"
                              aria-label={`Quantity for ${a.name}`}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Group>
            ) : null}

            {/* Contact */}
            <Group title="Your details">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Labelled label="Full name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={fieldStyle}
                      className={inputCls}
                    />
                  </Labelled>
                  <Labelled label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={fieldStyle}
                      className={inputCls}
                    />
                  </Labelled>
                </div>
                <Labelled label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={fieldStyle}
                    className={inputCls}
                  />
                </Labelled>
                <Labelled label="Special requests (optional)">
                  <textarea
                    value={requests}
                    onChange={(e) => setRequests(e.target.value)}
                    rows={3}
                    style={fieldStyle}
                    className={`${inputCls} resize-y`}
                  />
                </Labelled>
              </div>
            </Group>

            {/* Party manifest — optional details for the other guests */}
            {partySlots > 0 ? (
              <Group title="Who else is coming? (optional)">
                <div className="space-y-3">
                  {Array.from({ length: partySlots }).map((_, i) => (
                    <div key={i} className="grid gap-3 sm:grid-cols-3">
                      <input
                        value={party[i]?.name ?? ""}
                        onChange={(e) =>
                          updateParty(i, { name: e.target.value })
                        }
                        placeholder={`Guest ${i + 2} name`}
                        style={fieldStyle}
                        className={inputCls}
                        aria-label={`Guest ${i + 2} name`}
                      />
                      <input
                        type="email"
                        value={party[i]?.email ?? ""}
                        onChange={(e) =>
                          updateParty(i, { email: e.target.value })
                        }
                        placeholder="Email (optional)"
                        style={fieldStyle}
                        className={inputCls}
                        aria-label={`Guest ${i + 2} email`}
                      />
                      <input
                        value={party[i]?.phone ?? ""}
                        onChange={(e) =>
                          updateParty(i, { phone: e.target.value })
                        }
                        placeholder="Phone (optional)"
                        style={fieldStyle}
                        className={inputCls}
                        aria-label={`Guest ${i + 2} phone`}
                      />
                    </div>
                  ))}
                </div>
              </Group>
            ) : null}
          </div>
        </Card>

        {/* ── Summary / payment ── — shared sticky-card rule so the checkout
             Summary and the room-detail booking dock behave identically. (Grid
             item → self-start so it's natural height and can stick.) */}
        <div className="wielo-book-card-sticky wielo-book-card-selfstart">
          {/* Summary box reads the host's `--el-summary-*` styling (falls back to
              the Card/theme defaults when unset — Builder V3 Group 1 live styling). */}
          <Card
            className="p-6"
            style={{
              background: `var(--el-summary-bg, ${cardSurface})`,
              border: "var(--el-summary-bd, var(--site-card-border))",
              borderRadius: "var(--el-summary-radius, var(--site-card-radius))",
              color: "var(--el-summary-fg, var(--site-ink))",
            }}
          >
            <h3
              style={{ color: "var(--el-summary-fg, var(--site-ink))" }}
              className="text-base font-semibold"
            >
              Summary
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Stay">
                {quote
                  ? `${quote.nights} ${quote.nights === 1 ? "night" : "nights"}`
                  : "—"}
              </Row>
              <Row label="Guests">{guests || "—"}</Row>
              {quote && !quote.available ? (
                <p className="text-sm font-medium text-red-600">
                  Those dates aren’t available — please try different dates.
                </p>
              ) : null}
              {quote && quote.available && quote.total == null ? (
                <p className="text-sm font-medium text-red-600">
                  We couldn’t price this stay — check the minimum number of
                  nights or try different dates.
                </p>
              ) : null}

              {/* Coupon */}
              <div className="pt-1">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon code (optional)"
                  maxLength={40}
                  style={fieldStyle}
                  className={inputCls}
                  aria-label="Coupon code"
                />
                {coupon.trim() && quote ? (
                  <p
                    className={`mt-1 text-xs font-medium ${quote.couponApplied ? "text-green-600" : "text-red-600"}`}
                  >
                    {quote.couponApplied
                      ? "Coupon applied ✓"
                      : "That code doesn’t apply to your order."}
                  </p>
                ) : null}
              </div>

              {/* Active-offer line — makes it obvious in the summary that a special
                  is applied to this total (mirrors the checkout's offer card). */}
              {special ? (
                <div
                  style={{
                    background:
                      "var(--site-soft, color-mix(in srgb, var(--site-accent) 12%, var(--site-bg)))",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="mt-2 flex items-center justify-between gap-2 px-2.5 py-2"
                >
                  <span
                    style={{ color: "var(--site-accent)" }}
                    className="text-[11px] font-bold uppercase tracking-wide"
                  >
                    Special active
                  </span>
                  <span
                    style={{ color: "var(--site-ink)" }}
                    className="truncate text-right text-xs font-semibold"
                  >
                    {special.title}
                  </span>
                </div>
              ) : null}

              <div
                style={{ borderColor: "var(--site-line)" }}
                className="mt-3 flex items-center justify-between border-t pt-3"
              >
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="font-semibold"
                >
                  Total
                </span>
                <span
                  style={{
                    color: "var(--el-price-fg, var(--site-ink))",
                    fontSize: "var(--el-price-size, 1.125rem)",
                    fontWeight:
                      "var(--el-price-weight, 700)" as unknown as number,
                  }}
                  className="text-lg font-bold"
                >
                  {quoting
                    ? "…"
                    : (money(quote?.total ?? null, currency) ?? "—")}
                </span>
              </div>
              <TotalEstimate
                total={quote?.total ?? null}
                chargeCurrency={currency}
              />
              <Muted className="text-xs">
                Final price is confirmed on the next step.
              </Muted>
            </div>

            {/* Payment method */}
            {cardAvailable || eftAvailable || paypalAvailable ? (
              <div className="mt-5 space-y-2">
                {cardAvailable ? (
                  <PayChoice
                    active={method === "paystack"}
                    onClick={() => selectMethod("paystack")}
                    title="Pay by card"
                    sub="Secure card payment"
                  />
                ) : null}
                {paypalAvailable ? (
                  <PayChoice
                    active={method === "paypal"}
                    onClick={() => selectMethod("paypal")}
                    title="PayPal"
                    sub="Pay in USD with PayPal"
                  />
                ) : null}
                {eftAvailable ? (
                  <PayChoice
                    active={method === "eft"}
                    onClick={() => selectMethod("eft")}
                    title="Bank transfer (EFT)"
                    sub="Pay by manual EFT"
                  />
                ) : null}
                {/* Method explainer (mirrors the app's checkout) */}
                <p
                  style={{ color: "var(--site-mute)" }}
                  className="px-1 text-xs"
                >
                  {method === "eft"
                    ? "We’ll reserve your stay and email the bank details to complete your transfer."
                    : method === "paypal"
                      ? "You’ll finish securely on PayPal (charged in USD at today’s rate), then return here."
                      : "You’ll finish securely on the card-payment page, then return here."}
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-red-600">
                Online payment isn’t set up yet — please contact the host.
              </p>
            )}

            {/* Policy */}
            <label className="mt-5 flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span style={{ color: "var(--site-mute)" }}>
                {cancellation ? (
                  <>
                    <strong style={{ color: "var(--site-ink)" }}>
                      {cancellation.title}.
                    </strong>{" "}
                    I accept the booking and cancellation policies.
                  </>
                ) : (
                  "I accept the booking and cancellation policies."
                )}{" "}
                <button
                  type="button"
                  onClick={() => setPolicyOpen(true)}
                  style={{ color: "var(--site-accent)" }}
                  className="font-semibold underline underline-offset-2"
                >
                  View terms
                </button>
              </span>
            </label>

            {/* No bot-challenge in the builder preview (would load an external script). */}
            {preview ? null : (
              <div className="mt-4">
                <TurnstileWidget onVerify={setTsToken} resetSignal={tsNonce} />
              </div>
            )}

            {error ? (
              <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={onSubmit}
              disabled={preview || formInvalid || submitting}
              style={{
                // Pay button reads the host's `--el-button-*` styling (Builder V3
                // Group 1); falls back to the theme's primary-button tokens.
                background: "var(--el-button-bg, var(--site-btn-primary-bg))",
                color: "var(--el-button-fg, var(--site-btn-primary-color))",
                border: "var(--el-button-bd, var(--site-btn-primary-border))",
                borderRadius:
                  "var(--el-button-radius, var(--site-btn-primary-radius))",
              }}
              className="mt-5 inline-flex w-full items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting
                ? "Processing…"
                : method === "eft"
                  ? "Reserve & get EFT details"
                  : "Continue to payment"}
            </button>
          </Card>
        </div>
      </div>

      {/* Theme-scoped booking terms — a SiteThemeModal so it renders in THIS
          site's theme (not the app's styling). */}
      <SiteThemeModal
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
        title={cancellation?.title ?? "Booking & cancellation terms"}
        footer={
          <button
            type="button"
            onClick={() => {
              setAck(true);
              setPolicyOpen(false);
            }}
            style={{
              background: "var(--site-btn-primary-bg)",
              color: "var(--site-btn-primary-color)",
              border: "var(--site-btn-primary-border)",
              borderRadius: "var(--site-btn-primary-radius)",
            }}
            className="inline-flex w-full items-center justify-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            Accept &amp; close
          </button>
        }
      >
        {cancellation?.note ? (
          <p style={{ color: "var(--site-ink)" }}>{cancellation.note}</p>
        ) : null}
        <p style={{ color: "var(--site-mute)" }} className="mt-3">
          By continuing you agree to the host’s booking and cancellation
          policies. Your final price is confirmed before payment.
        </p>
      </SiteThemeModal>
    </SectionShell>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3
        style={{ color: "var(--site-ink)" }}
        className="mb-3 text-sm font-semibold"
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span
        style={{ color: "var(--site-ink)" }}
        className="text-sm font-medium"
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Labelled label={label}>
      <input
        type="number"
        min={0}
        max={20}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={fieldStyle}
        className={inputCls}
      />
    </Labelled>
  );
}

function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderColor: active ? "var(--site-accent)" : "var(--site-line)",
        color: active ? "var(--site-accent)" : "var(--site-mute)",
        borderRadius: "var(--site-radius)",
      }}
      className="flex-1 border px-3 py-2 text-sm font-semibold transition"
    >
      {children}
    </button>
  );
}

function PayChoice({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderColor: active ? "var(--site-accent)" : "var(--site-line)",
        borderRadius: "var(--site-radius)",
      }}
      className="flex w-full items-center justify-between border px-4 py-3 text-left transition"
    >
      <span>
        <span
          style={{ color: "var(--site-ink)" }}
          className="block text-sm font-semibold"
        >
          {title}
        </span>
        <span style={{ color: "var(--site-mute)" }} className="block text-xs">
          {sub}
        </span>
      </span>
      <span
        style={{
          borderColor: active ? "var(--site-accent)" : "var(--site-line)",
          background: active ? "var(--site-accent)" : "transparent",
        }}
        className="h-4 w-4 rounded-full border"
      />
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--site-mute)" }}>{label}</span>
      <span style={{ color: "var(--site-ink)" }} className="font-medium">
        {children}
      </span>
    </div>
  );
}
