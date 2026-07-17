"use client";

import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Calculator,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  ListPlus,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Tag,
  Trash2,
  TriangleAlert,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { ResumeDraftBanner } from "@/components/drafts/ResumeDraftBanner";
import { useAutosaveDraft } from "@/components/drafts/useAutosaveDraft";
import type { LoadedDraft } from "@/lib/drafts/store";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";

import { QuoteCalendar } from "./QuoteCalendar";
import {
  createQuoteAction,
  priceQuoteAction,
  getHostBrochureAction,
  removeHostBrochureAction,
  searchGuestsAction,
  sendQuoteAction,
  updateQuoteAction,
  uploadHostBrochureAction,
  uploadQuoteAttachmentAction,
} from "./actions";

export type QuoteFormRoom = {
  id: string;
  name: string;
  base_price: number | null;
  cleaning_fee: number | null;
  max_guests: number | null;
  base_occupancy: number | null;
  bed_type?: string | null;
  coverUrl?: string | null;
  allowChildren?: boolean;
  allowInfants?: boolean;
  allowPets?: boolean;
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
  city?: string | null;
  max_guests?: number | null;
  coverUrl?: string | null;
  allowChildren?: boolean;
  allowInfants?: boolean;
  allowPets?: boolean;
  /** YYYY-MM-DD nights already booked/blocked for this listing. */
  blocked?: string[];
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
  quoteType?: "accommodation" | "custom" | "upload";
  /** Headline for a custom/upload quote (no listing name to fall back on). */
  title?: string;
  /** Uploaded-quote file (quote_type = 'upload'). */
  attachmentPath?: string;
  attachmentName?: string;
  /** Host brochure attached to this quote (any quote_type). */
  brochurePath?: string;
  brochureName?: string;
  listingId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn?: string;
  checkOut?: string;
  headcount?: number;
  guestsBreakdown?: {
    adults?: number;
    children?: number;
    infants?: number;
    pets?: number;
  };
  scope?: "whole_listing" | "rooms";
  priceMode?: "itemised" | "single";
  baseAmount?: number;
  cleaningFee?: number;
  notes?: string;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number;
  discountReason?: string;
  depositType?: "deposit" | "full" | "reserve";
  depositPct?: number;
  balanceDueDays?: number;
  rooms?: {
    room_id: string;
    guests: number;
    base_amount: number;
    cleaning_fee: number;
  }[];
  catalogAddons?: { addon_id: string; quantity: number }[];
  customAddons?: { label: string; quantity: number; unit_price: number }[];
  /** Looking For post ID to link this quote to a guest request */
  lookingForPostId?: string;
};

// Left-rail steps for the page variant (mirrors the specials / add-ons editors).
const QUOTE_STEPS = [
  "Confirm the stay",
  "Your price",
  "Terms & reply",
  "Review",
] as const;
const QUOTE_STEP_ICONS: LucideIcon[] = [
  User,
  Calculator,
  Clock,
  ClipboardCheck,
];

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const f = new Date(`${checkIn}T00:00:00Z`).getTime();
  const t = new Date(`${checkOut}T00:00:00Z`).getTime();
  const n = Math.round((t - f) / 86_400_000);
  return n > 0 ? n : 0;
}

// The YYYY-MM-DD nights a [check_in, check_out) stay occupies — tested against
// the listing's blocked/booked dates to stop quoting unavailable nights.
function nightDates(checkIn: string, checkOut: string): string[] {
  if (!checkIn || !checkOut) return [];
  const out: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (cursor < end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function fmtDayShort(iso: string): { dow: string; day: string; mo: string } {
  if (!iso) return { dow: "—", day: "—", mo: "" };
  const d = new Date(`${iso}T00:00:00`);
  return {
    dow: d.toLocaleDateString("en-ZA", { weekday: "short" }),
    day: d.toLocaleDateString("en-ZA", { day: "numeric" }),
    mo: d.toLocaleDateString("en-ZA", { month: "short", year: "numeric" }),
  };
}

export function QuoteForm({
  listings,
  initial,
  isSentQuote = false,
  variant = "embedded",
  userId,
  serverDraft = null,
  quotesOnly = false,
}: {
  listings: QuoteFormListing[];
  initial?: QuoteFormInitial;
  // True when editing an already-SENT quote — saving is a revision: it needs a
  // reason, keeps the prior version, and posts a "revised" card to the thread.
  isSentQuote?: boolean;
  // "page" = the standalone new/edit quote pages → full left-rail step layout +
  // autosave. "embedded" (default) = the current stacked layout, used inside the
  // looking-for respond flow so that surface is unchanged.
  variant?: "page" | "embedded";
  // Present only in "page" contexts — enables auto-save drafts.
  userId?: string;
  serverDraft?: LoadedDraft | null;
  // A quotes-only account has no listings, so accommodation quotes are impossible
  // — the form defaults to (and is locked to) a custom/upload quote.
  quotesOnly?: boolean;
}) {
  const isPage = variant === "page";
  const router = useRouter();
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  const [sendingPending, startSending] = useTransition();
  const [pricing, startPricing] = useTransition();
  // Revision-reason prompt (only for editing a sent quote).
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [pendingSendAfter, setPendingSendAfter] = useState(false);

  // Left-rail step (page variant only): 0 stay · 1 price · 2 terms · 3 review.
  const [step, setStep] = useState(0);
  // True only while a recovery draft is being applied — lets the auto-pricing
  // effect skip that commit so a restored hand-set price isn't re-priced over.
  const restoringRef = useRef(false);

  // Quote type — accommodation (listing + calendar) vs a "manual" quote with no
  // calendar: built here (custom) or an uploaded file (upload). isCustomQuote =
  // either manual mode (both hide listing/dates + use a single total).
  const [quoteType, setQuoteType] = useState<
    "accommodation" | "custom" | "upload"
  >(
    initial?.quoteType === "custom"
      ? "custom"
      : initial?.quoteType === "upload"
        ? "upload"
        : quotesOnly
          ? "custom"
          : "accommodation",
  );
  const isCustomQuote = quoteType === "custom" || quoteType === "upload";
  const isUploadQuote = quoteType === "upload";
  const [customTitle, setCustomTitle] = useState(initial?.title ?? "");
  const [attachment, setAttachment] = useState<{
    path: string;
    name: string;
  } | null>(
    initial?.attachmentPath
      ? {
          path: initial.attachmentPath,
          name: initial.attachmentName ?? "Quote file",
        }
      : null,
  );
  const [uploading, setUploading] = useState(false);

  // Host brochure — uploaded ONCE to the account, then optionally attached to any
  // quote so the guest can download it alongside the quote PDF. `brochure` is the
  // saved account brochure; `attachBrochure` is whether THIS quote includes it.
  const [brochure, setBrochure] = useState<{
    path: string;
    name: string;
  } | null>(
    initial?.brochurePath
      ? { path: initial.brochurePath, name: initial.brochureName ?? "Brochure" }
      : null,
  );
  const [attachBrochure, setAttachBrochure] = useState(
    Boolean(initial?.brochurePath),
  );
  const [brochureUploading, setBrochureUploading] = useState(false);

  // Load the host's saved brochure once, so an existing brochure is offered even
  // on a brand-new quote (default it ON — the host uploaded it to be shared).
  useEffect(() => {
    let cancelled = false;
    void getHostBrochureAction().then((r) => {
      if (cancelled || !r.ok || !r.data) return;
      const loaded = r.data;
      setBrochure((prev) => prev ?? loaded);
      if (!initial?.id) setAttachBrochure(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [listingId, setListingId] = useState(
    initial?.listingId ?? listings[0]?.id ?? "",
  );
  const [guestName, setGuestName] = useState(initial?.guestName ?? "");
  const [guestEmail, setGuestEmail] = useState(initial?.guestEmail ?? "");
  const [guestPhone, setGuestPhone] = useState(initial?.guestPhone ?? "");
  const [sendVia, setSendVia] = useState<"both" | "email" | "link">("both");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const initialParty = initial?.guestsBreakdown;
  const initialHead = initial?.headcount ?? 2;
  const [adults, setAdults] = useState(
    Math.max(1, initialParty?.adults ?? initialHead),
  );
  const [children, setChildren] = useState(initialParty?.children ?? 0);
  const [infants, setInfants] = useState(initialParty?.infants ?? 0);
  const [pets, setPets] = useState(initialParty?.pets ?? 0);
  const [scope, setScope] = useState<"whole_listing" | "rooms">(
    initial?.scope ?? "whole_listing",
  );
  const [baseAmount, setBaseAmount] = useState(
    String(initial?.baseAmount ?? ""),
  );
  const [cleaningFee, setCleaningFee] = useState(
    String(initial?.cleaningFee ?? 0),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [validDays, setValidDays] = useState(3);
  // Itemised (line-by-line) vs a single negotiated total for the whole stay.
  // Seeded from the saved quote so a single-total quote reopens in single mode.
  const [priceMode, setPriceMode] = useState<"itemised" | "single">(
    initial?.priceMode ?? "itemised",
  );
  const [singleTotal, setSingleTotal] = useState(
    String(initial?.baseAmount ?? ""),
  );
  // Once the host hand-edits the whole-listing base/cleaning, auto-pricing stops
  // overwriting it (e.g. on a party change) — mirrors the per-room override.
  const [pricingTouched, setPricingTouched] = useState(false);
  // Optional quote-level discount.
  const [discountOn, setDiscountOn] = useState(
    !!initial?.discountType && (initial?.discountValue ?? 0) > 0,
  );
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    initial?.discountType ?? "percent",
  );
  const [discountValue, setDiscountValue] = useState(
    String(initial?.discountValue ?? ""),
  );
  const [discountReason, setDiscountReason] = useState(
    initial?.discountReason ?? "",
  );
  // Deposit terms — how the guest secures the quote.
  const [depositType, setDepositType] = useState<
    "deposit" | "full" | "reserve"
  >(initial?.depositType ?? "full");
  const [depositPct, setDepositPct] = useState(
    String(initial?.depositPct ?? 50),
  );
  const [balanceDueDays, setBalanceDueDays] = useState(
    String(initial?.balanceDueDays ?? 7),
  );

  const [roomGuests, setRoomGuests] = useState<Record<string, string>>(
    Object.fromEntries(
      (initial?.rooms ?? []).map((r) => [r.room_id, String(r.guests)]),
    ),
  );
  const [selectedRooms, setSelectedRooms] = useState<Record<string, boolean>>(
    Object.fromEntries((initial?.rooms ?? []).map((r) => [r.room_id, true])),
  );
  const [pricedRooms, setPricedRooms] = useState<PricedRoom[]>(
    (initial?.rooms ?? []).map((r) => ({
      room_id: r.room_id,
      base_amount: r.base_amount,
      cleaning_fee: r.cleaning_fee,
    })),
  );
  // Bumped each time pricing replaces the rooms — used to remount the editable
  // per-room amount fields so a fresh calendar price overrides a manual edit.
  const [priceVersion, setPriceVersion] = useState(0);
  // Reason the auto-price last failed — surfaced so a stuck R0 total is never a
  // silent dead-end (the host couldn't otherwise tell why a quote won't send).
  const [priceError, setPriceError] = useState<string | null>(null);
  const [catalogSel, setCatalogSel] = useState<Record<string, string>>(
    Object.fromEntries(
      (initial?.catalogAddons ?? []).map((a) => [
        a.addon_id,
        String(a.quantity),
      ]),
    ),
  );
  const [customAddons, setCustomAddons] = useState<AddonRow[]>(
    (initial?.customAddons ?? []).map((a) => ({
      label: a.label,
      quantity: String(a.quantity),
      unitPrice: String(a.unit_price),
    })),
  );
  // Derived child/infant/pet lines from the engine (recomputed on price).
  const [ageLines, setAgeLines] = useState<
    { label: string; quantity: number; unitPrice: number; subtotal: number }[]
  >([]);

  const listing = listings.find((l) => l.id === listingId);
  const currency = listing?.currency ?? "ZAR";
  const hasRooms = (listing?.rooms.length ?? 0) > 0;
  const nights = nightsBetween(checkIn, checkOut);
  const headcount = Math.max(1, adults + children);
  const blockedSet = useMemo(() => new Set(listing?.blocked ?? []), [listing]);

  // Availability guard — the chosen stay may not overlap nights that are already
  // booked or blocked. Conflicting nights disable Save/Send until the host picks
  // open dates (or the blocked nights free up). Excludes this quote's own hold
  // (the loader already removed it for the edit page).
  const conflictNights = useMemo(() => {
    if (!checkIn || !checkOut) return [];
    return nightDates(checkIn, checkOut).filter((d) => blockedSet.has(d));
  }, [checkIn, checkOut, blockedSet]);
  const hasDateConflict = conflictNights.length > 0;

  // Collapsible panels — open by default when there's nothing chosen yet.
  const [changingListing, setChangingListing] = useState(!initial?.listingId);
  const [adjustingStay, setAdjustingStay] = useState(
    !(initial?.checkIn && initial?.checkOut),
  );
  const [addCatalogOpen, setAddCatalogOpen] = useState(false);
  // Guest-facing preview + send modal.
  const [previewOpen, setPreviewOpen] = useState(false);

  // Which age/pet categories the host allows for the current selection. Rooms
  // scope: every selected room must allow it; whole-listing: the listing's flag.
  const allow = useMemo(() => {
    const sel = (listing?.rooms ?? []).filter((r) => selectedRooms[r.id]);
    if (scope === "rooms" && sel.length > 0) {
      return {
        children: sel.every((r) => r.allowChildren !== false),
        infants: sel.every((r) => r.allowInfants !== false),
        pets: sel.every((r) => r.allowPets !== false),
      };
    }
    return {
      children: listing?.allowChildren !== false,
      infants: listing?.allowInfants !== false,
      pets: listing?.allowPets !== false,
    };
  }, [scope, listing, selectedRooms]);

  // Reset a category when it becomes disallowed.
  useEffect(() => {
    if (!allow.children && children > 0) setChildren(0);
    if (!allow.infants && infants > 0) setInfants(0);
    if (!allow.pets && pets > 0) setPets(0);
  }, [allow, children, infants, pets]);

  // Sleeping capacity — adults + children count toward it (infants + pets don't).
  // Whole listing → the listing's max; per-room → the booked rooms' combined max.
  const capacityLimit = useMemo(() => {
    if (scope === "rooms") {
      const sel = (listing?.rooms ?? []).filter((r) => selectedRooms[r.id]);
      const total = sel.reduce((s, r) => s + (r.max_guests ?? 0), 0);
      return total > 0 ? total : Infinity;
    }
    return listing?.max_guests ?? Infinity;
  }, [scope, listing, selectedRooms]);
  const partySize = adults + children;
  const overCapacity = capacityLimit !== Infinity && partySize > capacityLimit;
  const capacityRemaining =
    capacityLimit === Infinity ? 999 : Math.max(0, capacityLimit - partySize);

  // A Looking-For response is an OFFER, not a booking — so over-capacity is a soft
  // warning here (the host may be pitching an overflow/multi-unit arrangement for a
  // 60-guest wedding), not a hard block. Direct-booking quotes keep the hard block
  // (a real booking must fit). D1 in LOOKING_FOR_QUOTE_TYPES_AND_OFFLINE_SYSTEM_PLAN.
  const isLookingForResponse = !!initial?.lookingForPostId;

  // ── Returning-guest search ───────────────────────────────────────
  const [guestResults, setGuestResults] = useState<
    { name: string; email: string; phone: string | null; stays: number }[]
  >([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onGuestNameChange(v: string) {
    setGuestName(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.trim().length < 2) {
      setGuestResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const r = await searchGuestsAction(v);
      if (r.ok && r.data) {
        setGuestResults(r.data);
        setShowResults(true);
      }
    }, 250);
  }
  function pickGuest(g: { name: string; email: string; phone: string | null }) {
    setGuestName(g.name);
    setGuestEmail(g.email);
    if (g.phone) setGuestPhone(g.phone);
    setShowResults(false);
  }

  function changeListing(id: string) {
    setListingId(id);
    setSelectedRooms({});
    setRoomGuests({});
    setPricedRooms([]);
    setCatalogSel({});
    setChangingListing(false);
    const next = listings.find((l) => l.id === id);
    setScope(
      next && next.rooms.length > 0 && next.booking_mode === "rooms_only"
        ? "rooms"
        : "whole_listing",
    );
  }

  const catalogLines = useMemo(() => {
    const out: {
      label: string;
      quantity: number;
      unit_price: number;
      addon_id: string;
    }[] = [];
    for (const a of listing?.addons ?? []) {
      const raw = catalogSel[a.id];
      if (raw == null) continue;
      const chosen = parseInt(raw, 10);
      if (!Number.isFinite(chosen) || chosen <= 0) continue;
      let quantity = chosen;
      if (a.pricing_model === "per_night") quantity = Math.max(1, nights || 1);
      if (a.pricing_model === "per_person") quantity = Math.max(1, headcount);
      out.push({
        label: a.name,
        quantity,
        unit_price: a.unit_price,
        addon_id: a.id,
      });
    }
    return out;
  }, [listing, catalogSel, nights, headcount]);

  const totals = useMemo(() => {
    if (priceMode === "single") {
      const t = parseFloat(singleTotal) || 0;
      return {
        base: t,
        cleaning: 0,
        addonsSum: 0,
        ageSum: 0,
        subtotal: t,
        discountAmount: 0,
        total: t,
      };
    }
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
    const ageSum = ageLines.reduce((s, a) => s + a.subtotal, 0);
    const addonsSum = catalogSum + customSum + ageSum;
    const subtotal = base + cleaning + addonsSum;
    const v = parseFloat(discountValue) || 0;
    let discountAmount = 0;
    if (discountOn && v > 0) {
      discountAmount =
        discountType === "percent"
          ? Math.round((subtotal * Math.min(v, 100)) / 100)
          : Math.min(v, subtotal);
    }
    return {
      base,
      cleaning,
      addonsSum,
      ageSum,
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  }, [
    priceMode,
    singleTotal,
    scope,
    pricedRooms,
    baseAmount,
    cleaningFee,
    catalogLines,
    customAddons,
    ageLines,
    discountOn,
    discountType,
    discountValue,
  ]);

  function toggleRoom(roomId: string) {
    setSelectedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }));
    setPricedRooms([]);
  }

  // Host override of a single room's pulled-in price. Stays until they change
  // the stay (which re-prices) or hit "Re-price from calendar".
  function setRoomBase(roomId: string, amount: number) {
    setPricedRooms((prev) =>
      prev.map((r) =>
        r.room_id === roomId ? { ...r, base_amount: amount } : r,
      ),
    );
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
          property_id: listingId,
          check_in: checkIn,
          check_out: checkOut,
          scope,
          guests: headcount,
          rooms: chosenRooms,
          party: { children, infants, pets },
        });
        if (!r.ok || !r.data) {
          const msg = r.ok ? "Could not price this stay." : r.error;
          // Surface the reason even on the silent auto-price path — otherwise the
          // host just sees a stuck R0 total and a quote that won't send.
          setPriceError(msg);
          if (!silent) toast.error(msg);
          return;
        }
        setPriceError(null);
        if (scope === "rooms") setPricedRooms(r.data.rooms);
        // Don't overwrite a base/cleaning the host has manually edited.
        else if (!pricingTouched) {
          setBaseAmount(String(r.data.base_amount));
          setCleaningFee(String(r.data.cleaning_fee));
        }
        setAgeLines(r.data.age_lines);
        // Remount the per-room amount inputs so they show the fresh price,
        // discarding any manual override the host had typed.
        setPriceVersion((v) => v + 1);
      });
    },
    [
      listingId,
      checkIn,
      checkOut,
      nights,
      scope,
      headcount,
      children,
      infants,
      pets,
      selectedRooms,
      roomGuests,
      listing,
      pricingTouched,
    ],
  );

  // Upload quotes carry an attached file for one agreed figure — pin them to a
  // single hand-entered total. Custom quotes, though, have no calendar but STILL
  // build line-by-line: they get the itemised card (custom lines + discount) so a
  // quotes-only host can itemise a bespoke quote. Only the accommodation/calendar
  // machinery is skipped (guarded by !datesValid + !isCustomQuote below).
  useEffect(() => {
    if (isUploadQuote && priceMode !== "single") setPriceMode("single");
  }, [isUploadQuote, priceMode]);

  useEffect(() => {
    if (restoringRef.current) return; // don't re-price over a restored draft
    // Single-total is a hand-set figure — never auto-price over it.
    if (priceMode === "single") return;
    if (!datesValid) return;
    if (scope === "rooms") {
      const anyRoom = (listing?.rooms ?? []).some((r) => selectedRooms[r.id]);
      if (!anyRoom) {
        setPricedRooms([]);
        // Per-room pricing needs a room — say so instead of a silent R0.
        setPriceError("Select at least one room to price this quote.");
        return;
      }
    }
    priceStayNow(true);
  }, [
    priceMode,
    scope,
    datesValid,
    listing,
    selectedRooms,
    roomGuests,
    headcount,
    priceStayNow,
  ]);

  // Clear the restore guard after the auto-pricing effect above has run for this
  // commit (defined last so it runs last), so later edits re-price normally.
  useEffect(() => {
    if (restoringRef.current) restoringRef.current = false;
  });

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

  function quickDates(nightsCount: number, fromWeekend: boolean) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    if (fromWeekend) {
      // Next Friday.
      const day = base.getDay();
      const add = (5 - day + 7) % 7 || 7;
      base.setDate(base.getDate() + add);
    } else {
      base.setDate(base.getDate() + 7);
    }
    const ci = base.toISOString().slice(0, 10);
    const out = new Date(base);
    out.setDate(out.getDate() + nightsCount);
    setCheckIn(ci);
    setCheckOut(out.toISOString().slice(0, 10));
  }

  function insertSnippet(text: string) {
    setNotes((n) => (n.trim() ? `${n.trim()}\n\n${text}` : text));
  }

  function switchPriceMode(mode: "itemised" | "single") {
    if (mode === "single" && !(parseFloat(singleTotal) > 0)) {
      // Seed the single total from the itemised total so nothing is lost.
      setSingleTotal(String(Math.round(totals.total)));
    }
    setPriceMode(mode);
  }

  async function handleAttachmentUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadQuoteAttachmentAction(fd);
      if (!r.ok || !r.data) {
        toast.error(r.ok ? "Upload failed." : r.error);
        return;
      }
      const uploaded = r.data;
      setAttachment(uploaded);
      // Seed the title from the filename if the host hasn't set one.
      if (!customTitle.trim()) {
        setCustomTitle(uploaded.name.replace(/\.[^.]+$/, "").slice(0, 200));
      }
      toast.success("File uploaded");
    } finally {
      setUploading(false);
    }
  }

  async function handleBrochureUpload(file: File) {
    setBrochureUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadHostBrochureAction(fd);
      if (!r.ok || !r.data) {
        toast.error(r.ok ? "Upload failed." : r.error);
        return;
      }
      setBrochure(r.data);
      setAttachBrochure(true);
      toast.success("Brochure saved to your account");
    } finally {
      setBrochureUploading(false);
    }
  }

  // Remove the account brochure entirely (not just detach it from this quote).
  async function handleBrochureRemove() {
    setBrochureUploading(true);
    try {
      const r = await removeHostBrochureAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setBrochure(null);
      setAttachBrochure(false);
      toast.success("Brochure removed from your account");
    } finally {
      setBrochureUploading(false);
    }
  }

  // Attach the saved brochure to this quote only when the host opted in.
  function brochureFields() {
    const on = attachBrochure && brochure;
    return {
      brochure_path: on ? brochure.path : "",
      brochure_name: on ? brochure.name : "",
    };
  }

  function buildInput() {
    if (priceMode === "single") {
      return {
        quote_type: quoteType,
        title: isCustomQuote ? customTitle.trim() : undefined,
        attachment_path: isUploadQuote ? (attachment?.path ?? "") : undefined,
        attachment_name: isUploadQuote ? (attachment?.name ?? "") : undefined,
        ...brochureFields(),
        property_id: isCustomQuote ? undefined : listingId,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim(),
        check_in: isCustomQuote ? undefined : checkIn,
        check_out: isCustomQuote ? undefined : checkOut,
        headcount,
        scope: isCustomQuote ? undefined : ("whole_listing" as const),
        base_amount: parseFloat(singleTotal) || 0,
        cleaning_fee: 0,
        currency,
        rooms: [] as PricedRoom[],
        addons: [] as {
          label: string;
          quantity: number;
          unit_price: number;
          addon_id: string | null;
          kind: "custom" | "catalog" | "age";
        }[],
        guests_breakdown: { adults, children, infants, pets },
        discount_type: null as "percent" | "fixed" | null,
        discount_value: 0,
        discount_reason: "",
        deposit_type: depositType,
        deposit_pct: parseFloat(depositPct) || 50,
        balance_due_days: parseInt(balanceDueDays, 10) || 7,
        price_mode: "single" as const,
        notes: notes.trim(),
        // Carry the Looking-For link so sendQuoteAction can create the response
        // row + notify the guest. Passed in via initial from the respond flow.
        looking_for_post_id: initial?.lookingForPostId,
      };
    }
    const addons = [
      ...catalogLines.map((a) => ({
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        addon_id: a.addon_id as string | null,
        kind: "catalog" as const,
      })),
      ...customAddons
        .filter((a) => a.label.trim().length > 0)
        .map((a) => ({
          label: a.label.trim(),
          quantity: parseFloat(a.quantity) || 0,
          unit_price: parseFloat(a.unitPrice) || 0,
          addon_id: null as string | null,
          kind: "custom" as const,
        })),
      // Derived child/infant/pet lines — tagged so editing recomputes them.
      ...ageLines.map((a) => ({
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unitPrice,
        addon_id: null as string | null,
        kind: "age" as const,
      })),
    ];
    return {
      quote_type: quoteType,
      title: isCustomQuote ? customTitle.trim() : undefined,
      ...brochureFields(),
      property_id: isCustomQuote ? undefined : listingId,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      guest_phone: guestPhone.trim(),
      check_in: isCustomQuote ? undefined : checkIn,
      check_out: isCustomQuote ? undefined : checkOut,
      headcount,
      scope: isCustomQuote ? undefined : scope,
      base_amount: totals.base,
      cleaning_fee: totals.cleaning,
      currency,
      rooms: scope === "rooms" ? pricedRooms : [],
      addons,
      guests_breakdown: { adults, children, infants, pets },
      discount_type: discountOn ? discountType : null,
      discount_value: discountOn ? parseFloat(discountValue) || 0 : 0,
      discount_reason: discountOn ? discountReason.trim() : "",
      deposit_type: depositType,
      deposit_pct: parseFloat(depositPct) || 50,
      balance_due_days: parseInt(balanceDueDays, 10) || 7,
      price_mode: "itemised" as const,
      notes: notes.trim(),
      // Carry the Looking-For link so sendQuoteAction can create the response
      // row + notify the guest. Passed in via initial from the respond flow.
      looking_for_post_id: initial?.lookingForPostId,
    };
  }

  // Deposit due to accept + balance owed later (display only; server recomputes).
  const deposit = useMemo(() => {
    const t = totals.total;
    if (depositType === "deposit") {
      const d = Math.round(
        (t * Math.min(parseFloat(depositPct) || 0, 100)) / 100,
      );
      return { due: d, balance: t - d };
    }
    if (depositType === "reserve") return { due: 0, balance: t };
    return { due: t, balance: 0 };
  }, [totals.total, depositType, depositPct]);

  function validate(): boolean {
    const input = buildInput();
    if (!input.guest_name || !input.guest_email) {
      toast.error("Add the guest's name and email.");
      return false;
    }
    if (isCustomQuote) {
      // Custom/upload quotes have no listing/calendar — just a title + a price.
      if (!customTitle.trim()) {
        toast.error("Give this quote a short title.");
        return false;
      }
      if (isUploadQuote && !attachment) {
        toast.error("Upload the quote file first.");
        return false;
      }
    } else {
      if (!input.property_id) {
        toast.error("Pick a listing.");
        return false;
      }
      if (!datesValid) {
        toast.error("Set valid check-in and check-out dates.");
        return false;
      }
      if (hasDateConflict) {
        toast.error(
          "Those dates include nights that are already booked or blocked. Pick open dates first.",
        );
        return false;
      }
      if (input.scope === "rooms" && input.rooms.length === 0) {
        toast.error("Select rooms and price them first.");
        return false;
      }
    }
    if (input.base_amount <= 0 && totals.total <= 0) {
      toast.error("Add a price before sending.");
      return false;
    }
    if (overCapacity && !isLookingForResponse && !isCustomQuote) {
      toast.error(
        `That's more guests than this sleeps (${capacityLimit}). Adults + children must fit.`,
      );
      return false;
    }
    return true;
  }

  function save(sendAfter: boolean, revisionReason?: string) {
    if (!validate()) return;
    // Revising an already-sent quote needs a reason for the audit trail — gather
    // it first (the server enforces this too).
    if (isSentQuote && initial?.id && !(revisionReason ?? "").trim()) {
      setPendingSendAfter(sendAfter);
      setPreviewOpen(false);
      setReasonOpen(true);
      return;
    }
    const input = buildInput();

    if (initial?.id) {
      start(async () => {
        const result = await updateQuoteAction(
          initial.id!,
          input,
          revisionReason,
        );
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        draft.clearSaved();
        if (sendAfter) {
          startSending(async () => {
            const r = await sendQuoteAction(initial.id!, validDays);
            if (!r.ok) toast.error(r.error);
            else toast.success("Quote sent");
            router.push(`/dashboard/quotes/${initial.id}`);
          });
        } else {
          toast.success(isSentQuote ? "Quote revised" : "Quote saved");
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
        draft.clearSaved();
        if (sendAfter) {
          const r = await sendQuoteAction(result.data.id, validDays);
          if (!r.ok) toast.error(r.error);
          else toast.success("Quote sent");
        } else {
          toast.success("Quote saved");
        }
        router.push(`/dashboard/quotes/${result.data.id}`);
      });
    }
  }

  function confirmRevision() {
    if (!reasonText.trim()) {
      toast.error("Add a short reason for the change.");
      return;
    }
    setReasonOpen(false);
    save(pendingSendAfter, reasonText.trim());
  }

  function openPreview() {
    if (!validate()) return;
    setPreviewOpen(true);
  }

  const busy = pending || sendingPending || pricing;
  const validUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + validDays);
    return d.toLocaleDateString("en-ZA", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [validDays]);

  // "Until check-in" expiry — days from today to the check-in date.
  const daysToCheckIn = useMemo(() => {
    if (!checkIn) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ci = new Date(`${checkIn}T00:00:00`).getTime();
    const d = Math.round((ci - today.getTime()) / 86_400_000);
    return d > 0 ? d : null;
  }, [checkIn]);

  const selectedRoomObjs = (listing?.rooms ?? []).filter(
    (r) => selectedRooms[r.id],
  );
  const roomScopeLabel =
    scope === "rooms"
      ? selectedRoomObjs.map((r) => r.name).join(", ") || "Select rooms"
      : "Whole listing";

  // Line items shown to the guest (preview) and in the itemised editor summary.
  const guestLines = useMemo(() => {
    if (priceMode === "single") {
      return [{ label: "Your stay", amount: totals.total, muted: false }];
    }
    const lines: { label: string; amount: number; muted?: boolean }[] = [];
    if (scope === "rooms") {
      for (const r of pricedRooms) {
        const name =
          (listing?.rooms ?? []).find((x) => x.id === r.room_id)?.name ??
          "Room";
        lines.push({ label: name, amount: r.base_amount });
      }
    } else if (totals.base > 0) {
      lines.push({
        label:
          nights > 0 ? `Accommodation · ${nights} nights` : "Accommodation",
        amount: totals.base,
      });
    }
    if (totals.cleaning > 0)
      lines.push({ label: "Cleaning fee", amount: totals.cleaning });
    for (const a of catalogLines)
      lines.push({ label: a.label, amount: a.quantity * a.unit_price });
    for (const a of customAddons.filter((x) => x.label.trim()))
      lines.push({
        label: a.label,
        amount: (parseFloat(a.quantity) || 0) * (parseFloat(a.unitPrice) || 0),
      });
    for (const a of ageLines)
      lines.push({ label: a.label, amount: a.subtotal });
    return lines;
  }, [
    priceMode,
    scope,
    pricedRooms,
    listing,
    totals.base,
    totals.cleaning,
    totals.total,
    nights,
    catalogLines,
    customAddons,
    ageLines,
  ]);

  const ci = fmtDayShort(checkIn);
  const co = fmtDayShort(checkOut);
  const firstName = guestName.trim().split(/\s+/)[0] || "the guest";
  const step1Done = isCustomQuote
    ? !!customTitle.trim() &&
      !!guestName &&
      !!guestEmail &&
      (!isUploadQuote || !!attachment)
    : !!listingId && datesValid && !!guestName && !!guestEmail;

  // ── Auto-save drafts (page variant only) ─────────────────────────
  type QuoteDraftPayload = {
    listingId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    sendVia: "both" | "email" | "link";
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    infants: number;
    pets: number;
    scope: "whole_listing" | "rooms";
    baseAmount: string;
    cleaningFee: string;
    notes: string;
    validDays: number;
    priceMode: "itemised" | "single";
    singleTotal: string;
    pricingTouched: boolean;
    discountOn: boolean;
    discountType: "percent" | "fixed";
    discountValue: string;
    discountReason: string;
    depositType: "deposit" | "full" | "reserve";
    depositPct: string;
    balanceDueDays: string;
    roomGuests: Record<string, string>;
    selectedRooms: Record<string, boolean>;
    catalogSel: Record<string, string>;
    customAddons: AddonRow[];
  };
  const draftValue = useMemo<QuoteDraftPayload>(
    () => ({
      listingId,
      guestName,
      guestEmail,
      guestPhone,
      sendVia,
      checkIn,
      checkOut,
      adults,
      children,
      infants,
      pets,
      scope,
      baseAmount,
      cleaningFee,
      notes,
      validDays,
      priceMode,
      singleTotal,
      pricingTouched,
      discountOn,
      discountType,
      discountValue,
      discountReason,
      depositType,
      depositPct,
      balanceDueDays,
      roomGuests,
      selectedRooms,
      catalogSel,
      customAddons,
    }),
    [
      listingId,
      guestName,
      guestEmail,
      guestPhone,
      sendVia,
      checkIn,
      checkOut,
      adults,
      children,
      infants,
      pets,
      scope,
      baseAmount,
      cleaningFee,
      notes,
      validDays,
      priceMode,
      singleTotal,
      pricingTouched,
      discountOn,
      discountType,
      discountValue,
      discountReason,
      depositType,
      depositPct,
      balanceDueDays,
      roomGuests,
      selectedRooms,
      catalogSel,
      customAddons,
    ],
  );

  const applyDraft = useCallback((p: QuoteDraftPayload) => {
    restoringRef.current = true;
    setListingId(p.listingId);
    setGuestName(p.guestName);
    setGuestEmail(p.guestEmail);
    setGuestPhone(p.guestPhone);
    setSendVia(p.sendVia);
    setCheckIn(p.checkIn);
    setCheckOut(p.checkOut);
    setAdults(p.adults);
    setChildren(p.children);
    setInfants(p.infants);
    setPets(p.pets);
    setScope(p.scope);
    setBaseAmount(p.baseAmount);
    setCleaningFee(p.cleaningFee);
    setNotes(p.notes);
    setValidDays(p.validDays);
    setPriceMode(p.priceMode);
    setSingleTotal(p.singleTotal);
    setPricingTouched(p.pricingTouched);
    setDiscountOn(p.discountOn);
    setDiscountType(p.discountType);
    setDiscountValue(p.discountValue);
    setDiscountReason(p.discountReason);
    setDepositType(p.depositType);
    setDepositPct(p.depositPct);
    setBalanceDueDays(p.balanceDueDays);
    setRoomGuests(p.roomGuests);
    setSelectedRooms(p.selectedRooms);
    setCatalogSel(p.catalogSel);
    setCustomAddons(p.customAddons);
    toast.success("Draft restored");
  }, []);

  const draftTarget = useMemo(
    () => ({
      entityType: "quote" as const,
      entityId: initial?.id ?? null,
      scopeId: null,
    }),
    [initial?.id],
  );

  const draft = useAutosaveDraft({
    userId: userId ?? "",
    target: draftTarget,
    value: draftValue,
    onRestore: applyDraft,
    enabled: isPage && !!userId,
    serverDraft,
  });

  // ── Left-rail step meta (page variant) ───────────────────────────
  const stepShow = (n: number) => !isPage || step === n;
  const priceReady = totals.total > 0;
  const railDone = [step1Done, priceReady, true, step1Done && priceReady];
  const railSub = [
    guestName.trim() || listing?.name || "Guest & stay",
    priceReady ? formatMoney(totals.total, currency) : "Set the price",
    `${validDays}-day validity`,
    step1Done && priceReady ? "Ready to send" : "Finish the basics",
  ];
  const stepValidQ = [step1Done, priceReady, true, true];
  const railMilestones = [step1Done, priceReady];
  const railPct = Math.round(
    (railMilestones.filter(Boolean).length / railMilestones.length) * 100,
  );
  const allReadyQ = step1Done && priceReady;
  function goToStep(target: number) {
    if (target <= step) return setStep(target);
    for (let s = step; s < target; s++) {
      if (!stepValidQ[s]) return void toast.error("Finish this step first.");
    }
    setStep(target);
  }

  // ── Render ───────────────────────────────────────────────────────
  const dividerLabel = (
    <div className="flex items-center gap-3 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {initial?.id ? "Your response" : "Build the quote"}
      </span>
      <span className="h-px flex-1 bg-brand-line" />
      <span className="text-[11px] text-brand-mute">3 quick steps</span>
    </div>
  );

  const sectionsInner = (
    <div className={isPage ? "space-y-5" : "mt-5 space-y-5 pb-28"}>
      {stepShow(0) && (
        <>
          {/* ===== STEP 1 — CONFIRM THE STAY ===== */}
          <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
            <SecHeader
              n={1}
              done={step1Done}
              title="Confirm the stay"
              sub="Who it's for, where they're staying, and the dates. Adjust anything that needs changing."
            />

            {/* Quote type — accommodation (listing + calendar) vs custom (line
                items, no calendar). Only choosable on a new quote, and only when
                the account can make accommodation quotes (a quotes-only account
                has no listings, so it's custom/upload only — hide the picker). */}
            {!initial?.id && !quotesOnly && (
              <div className="mt-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                  Quote type
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        v: "accommodation" as const,
                        t: "Accommodation",
                        d: "A stay — pick a listing + dates",
                      },
                      {
                        v: "custom" as const,
                        t: "Custom quote",
                        d: "Build here or upload a PDF — no calendar",
                      },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setQuoteType(o.v)}
                      className={`rounded-[12px] border p-3 text-left transition ${
                        (o.v === "custom" ? isCustomQuote : quoteType === o.v)
                          ? "border-brand-primary bg-brand-accent/40 ring-1 ring-brand-primary"
                          : "border-brand-line bg-white hover:border-brand-primary/40"
                      }`}
                    >
                      <div className="text-[13px] font-semibold text-brand-ink">
                        {o.t}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-brand-mute">
                        {o.d}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Manual quote — build it here (default) or upload a finished PDF.
                Only switchable on a new quote. */}
            {isCustomQuote && !initial?.id && (
              <div className="mt-5">
                <FieldLabel>How do you want to quote?</FieldLabel>
                <Seg
                  value={isUploadQuote ? "upload" : "build"}
                  onChange={(v) =>
                    setQuoteType(v === "upload" ? "upload" : "custom")
                  }
                  options={[
                    { value: "build", label: "Build it here" },
                    { value: "upload", label: "Upload a PDF" },
                  ]}
                />
              </div>
            )}

            {/* Custom-quote headline (no listing name to fall back on). */}
            {isCustomQuote && (
              <div className="mt-5">
                <FieldLabel>Quote title *</FieldLabel>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Sunset safari drive for 4"
                />
              </div>
            )}

            {/* Uploaded quote file. */}
            {isUploadQuote && (
              <div className="mt-5">
                <FieldLabel>Quote file *</FieldLabel>
                {attachment ? (
                  <div className="flex items-center justify-between gap-3 rounded-[10px] border border-brand-line bg-brand-light/40 px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-[13px] text-brand-ink">
                      <Paperclip className="h-4 w-4 shrink-0 text-brand-primary" />
                      <span className="truncate">{attachment.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="shrink-0 text-[12px] font-semibold text-brand-mute hover:text-status-cancelled"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-brand-line bg-white px-3 py-4 text-[13px] font-medium text-brand-mute transition hover:border-brand-primary/50 hover:text-brand-ink">
                    <Paperclip className="h-4 w-4" />
                    {uploading
                      ? "Uploading…"
                      : "Choose a PDF, Word doc or image"}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAttachmentUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <p className="mt-1.5 text-[11.5px] text-brand-mute">
                  The guest downloads this file. Set the total below so Wielo
                  can track the quote.
                </p>
              </div>
            )}

            {/* Guest */}
            <div className="mt-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                Guest
              </div>

              {/* Pull in an existing guest — searches past bookers + your Guests
                directory and fills the fields below on pick. */}
              <div className="mt-2">
                <ExistingGuestPicker onPick={pickGuest} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="relative">
                  <FieldLabel>Full name *</FieldLabel>
                  <Input
                    value={guestName}
                    onChange={(e) => onGuestNameChange(e.target.value)}
                    onFocus={() => guestResults.length && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 150)}
                    placeholder="e.g. Aisha Patel"
                  />
                  {showResults && guestResults.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-brand-line bg-white shadow-lift">
                      {guestResults.map((g) => (
                        <button
                          key={g.email}
                          type="button"
                          onMouseDown={() => pickGuest(g)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-accent/40"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-white">
                            {(g.name || g.email)[0]?.toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-brand-ink">
                              {g.name || g.email}
                            </span>
                            <span className="block truncate text-xs text-brand-mute">
                              {g.email}
                            </span>
                          </span>
                          {g.stays > 0 ? (
                            <span className="shrink-0 rounded-pill bg-brand-accent px-1.5 py-0.5 text-[10px] font-semibold text-brand-secondary">
                              {g.stays} stay{g.stays === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div>
                  <FieldLabel>Email *</FieldLabel>
                  <Input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="guest@email.com"
                  />
                </div>
                <div>
                  <FieldLabel>Phone (for WhatsApp)</FieldLabel>
                  <Input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+27 …"
                  />
                </div>
                <div>
                  <FieldLabel>Send quote via</FieldLabel>
                  <Seg
                    value={sendVia}
                    onChange={(v) => setSendVia(v as typeof sendVia)}
                    options={[
                      { value: "both", label: "Email + WhatsApp" },
                      { value: "email", label: "Email" },
                      { value: "link", label: "Link" },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Listing, dates & party — accommodation quotes only. */}
            {!isCustomQuote && (
              <>
                {/* Matched listing / room */}
                <div className="mt-6">
                  <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                    Listing &amp; room
                  </div>
                  <div className="mt-2 flex items-center gap-3 rounded-[12px] border border-brand-line bg-brand-light/40 p-3">
                    <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[10px] bg-brand-light">
                      {listing?.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.coverUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-brand-mute">
                          <BedDouble className="h-5 w-5" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                        {listing?.name ?? "Pick a listing"}
                        {scope === "rooms" && selectedRoomObjs.length > 0
                          ? ` · ${selectedRoomObjs.map((r) => r.name).join(", ")}`
                          : ""}
                      </div>
                      <div className="truncate text-[11.5px] text-brand-mute">
                        {[
                          listing?.city,
                          listing?.max_guests
                            ? `sleeps ${listing.max_guests}`
                            : null,
                          listing?.base_price != null
                            ? `base ${formatMoney(listing.base_price, currency)} / night`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChangingListing((v) => !v)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-3 py-1.5 text-[11.5px] font-medium text-brand-ink hover:bg-brand-accent/40"
                    >
                      {changingListing ? "Done" : "Change"}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {changingListing ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {listings.map((l) => {
                        const on = l.id === listingId;
                        return (
                          <button
                            type="button"
                            key={l.id}
                            onClick={() => changeListing(l.id)}
                            className={`relative flex flex-col rounded-[12px] border p-3 text-left transition ${
                              on
                                ? "border-brand-primary bg-brand-accent/40 ring-2 ring-brand-primary/15"
                                : "border-brand-line bg-white hover:bg-brand-accent/20"
                            }`}
                          >
                            <span className="relative block h-24 w-full overflow-hidden rounded-[8px] bg-brand-light">
                              {l.coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={l.coverUrl}
                                  alt={l.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-brand-mute">
                                  <BedDouble className="h-6 w-6" />
                                </span>
                              )}
                              {on ? (
                                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-white">
                                  <Check className="h-3 w-3" />
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-2.5 flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-semibold text-brand-ink">
                                  {l.name}
                                </span>
                                <span className="block truncate text-[10.5px] text-brand-mute">
                                  {l.city ?? "—"}
                                  {l.max_guests
                                    ? ` · sleeps ${l.max_guests}`
                                    : ""}
                                </span>
                              </span>
                              {l.base_price != null ? (
                                <span className="text-right">
                                  <span className="block font-display text-[12.5px] font-bold text-brand-ink">
                                    {formatMoney(l.base_price, l.currency)}
                                  </span>
                                  <span className="block text-[9.5px] text-brand-mute">
                                    / night
                                  </span>
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {hasRooms ? (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        <Chip
                          active={scope === "whole_listing"}
                          onClick={() => {
                            setScope("whole_listing");
                            setPricedRooms([]);
                          }}
                          label="Whole listing"
                        />
                        <Chip
                          active={scope === "rooms"}
                          onClick={() => setScope("rooms")}
                          label="Specific rooms"
                        />
                      </div>
                      {scope === "rooms" ? (
                        <div className="mt-3 space-y-2">
                          {(listing?.rooms ?? []).map((r) => {
                            const on = !!selectedRooms[r.id];
                            const priced = pricedRooms.find(
                              (p) => p.room_id === r.id,
                            );
                            return (
                              <div
                                key={r.id}
                                className={`flex items-center gap-3 rounded-[10px] border p-3 ${on ? "border-brand-primary bg-brand-accent/30" : "border-brand-line bg-white"}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleRoom(r.id)}
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-brand-primary bg-brand-primary text-white" : "border-brand-line bg-white"}`}
                                >
                                  {on ? <Check className="h-3 w-3" /> : null}
                                </button>
                                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[8px] bg-brand-light">
                                  {r.coverUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={r.coverUrl}
                                      alt={r.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="flex h-full w-full items-center justify-center text-brand-mute">
                                      <BedDouble className="h-4 w-4" />
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12.5px] font-semibold text-brand-ink">
                                    {r.name}
                                    {r.bed_type ? ` · ${r.bed_type}` : ""}
                                  </span>
                                  <span className="block text-[11px] text-brand-mute">
                                    {r.max_guests
                                      ? `sleeps ${r.max_guests}`
                                      : ""}
                                  </span>
                                </span>
                                {on ? (
                                  <span className="flex items-center gap-2 text-xs text-brand-mute">
                                    <span>Guests</span>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={r.max_guests ?? undefined}
                                      value={
                                        roomGuests[r.id] ??
                                        String(r.base_occupancy ?? 1)
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
                                        {formatMoney(
                                          priced.base_amount +
                                            priced.cleaning_fee,
                                          currency,
                                        )}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Dates + party summary */}
                <div className="mt-6">
                  <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                    Dates &amp; party
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="flex items-center justify-between rounded-[10px] border border-brand-line px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
                          Check-in → out
                        </div>
                        <div className="mt-0.5 truncate text-[13px] font-bold text-brand-ink">
                          {datesValid
                            ? `${ci.dow} ${ci.day} → ${co.dow} ${co.day} ${co.mo.split(" ")[0]}`
                            : "Pick dates"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-pill bg-brand-accent px-2 py-0.5 text-[11px] font-bold text-brand-secondary">
                        {nights} nt{nights === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-[10px] border border-brand-line px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
                          Guest party
                        </div>
                        <div className="mt-0.5 truncate text-[13px] font-bold text-brand-ink">
                          {adults} adult{adults === 1 ? "" : "s"}
                          {children
                            ? ` · ${children} child${children === 1 ? "" : "ren"}`
                            : ""}
                          {infants
                            ? ` · ${infants} infant${infants === 1 ? "" : "s"}`
                            : ""}
                          {pets ? ` · ${pets} pet${pets === 1 ? "" : "s"}` : ""}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjustingStay((v) => !v)}
                      className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-brand-line bg-white px-4 text-[12px] font-medium text-brand-ink hover:bg-brand-accent/40"
                    >
                      <Pencil className="h-3.5 w-3.5 text-brand-primary" />
                      {adjustingStay ? "Done" : "Adjust"}
                    </button>
                  </div>

                  {hasDateConflict ? (
                    <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-status-cancelled/30 bg-status-cancelled/5 px-3.5 py-2.5 text-[12px] text-status-cancelled">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-semibold">
                          {conflictNights.length} night
                          {conflictNights.length === 1 ? "" : "s"} in this range{" "}
                          {conflictNights.length === 1 ? "is" : "are"} already
                          booked or blocked.
                        </span>{" "}
                        Pick open dates (or free up those nights) — you
                        can&rsquo;t quote dates that aren&rsquo;t available.
                      </span>
                    </div>
                  ) : null}

                  {adjustingStay ? (
                    <div className="mt-3 rounded-[12px] border border-brand-line bg-brand-light/30 p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-brand-mute">
                          Quick add:
                        </span>
                        <Pill onClick={() => quickDates(2, true)}>
                          This weekend
                        </Pill>
                        <Pill onClick={() => quickDates(3, true)}>
                          Long weekend
                        </Pill>
                        <Pill onClick={() => quickDates(7, false)}>
                          7 nights
                        </Pill>
                      </div>
                      <div className="mt-3">
                        <QuoteCalendar
                          checkIn={checkIn}
                          checkOut={checkOut}
                          blocked={blockedSet}
                          onChange={(a, b) => {
                            setCheckIn(a);
                            setCheckOut(b);
                          }}
                        />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <Stepper
                          label="Adults"
                          hint="13 +"
                          value={adults}
                          min={1}
                          max={adults + capacityRemaining}
                          onChange={setAdults}
                        />
                        {allow.children ? (
                          <Stepper
                            label="Children"
                            hint="2 – 12"
                            value={children}
                            min={0}
                            max={children + capacityRemaining}
                            onChange={setChildren}
                          />
                        ) : null}
                        {allow.infants ? (
                          <Stepper
                            label="Infants"
                            hint="Under 2"
                            value={infants}
                            min={0}
                            onChange={setInfants}
                          />
                        ) : null}
                        {allow.pets ? (
                          <Stepper
                            label="Pets"
                            hint="Fee may apply"
                            value={pets}
                            min={0}
                            onChange={setPets}
                          />
                        ) : null}
                      </div>
                      {capacityLimit !== Infinity ? (
                        <p
                          className={`mt-2 text-[11px] ${overCapacity ? "font-semibold text-status-cancelled" : "text-brand-mute"}`}
                        >
                          {overCapacity
                            ? `Over capacity — sleeps up to ${capacityLimit} (adults + children). You have ${partySize}.`
                            : `${partySize} of ${capacityLimit} guest${capacityLimit === 1 ? "" : "s"} (adults + children). Infants & pets don't count.`}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {stepShow(1) && (
        <>
          {/* ===== STEP 2 — YOUR PRICE ===== */}
          <section className="rounded-card border border-brand-primary/30 bg-white p-6 shadow-card ring-1 ring-brand-primary/10">
            <SecHeader
              n={2}
              title="Your price"
              sub="The heart of your reply. Tweak any line, add charges, or give a discount — the guest sees exactly this."
              right={
                isUploadQuote ? null : (
                  <div className="flex w-full rounded-[10px] border border-brand-line bg-brand-light p-[3px] sm:w-auto">
                    {(
                      [
                        ["itemised", "Itemised"],
                        ["single", "Single total"],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => switchPriceMode(v)}
                        className={`flex-1 rounded-[7px] px-3 py-1.5 text-[12px] font-medium transition sm:flex-none ${priceMode === v ? "bg-white font-semibold text-brand-ink shadow-card" : "text-brand-mute hover:text-brand-ink"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )
              }
            />

            {priceMode === "itemised" ? (
              <>
                {isCustomQuote ? (
                  <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-brand-mute">
                    <Calculator className="h-3.5 w-3.5" />
                    Build your quote line by line — add a line for each charge.
                  </p>
                ) : !datesValid ? (
                  <p className="mt-5 text-xs text-brand-mute">
                    Add dates above — the price fills in from your calendar
                    automatically.
                  </p>
                ) : (
                  <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-brand-mute">
                    <Calculator className="h-3.5 w-3.5" />
                    {pricing
                      ? "Pricing from your calendar…"
                      : "Priced automatically from your calendar — edit any line below."}
                  </p>
                )}

                <div className="mt-4 rounded-[12px] border border-brand-line p-4">
                  <div className="grid grid-cols-[1fr_120px_28px] items-center gap-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                    <span>Item</span>
                    <span className="pr-1 text-right">Amount</span>
                    <span />
                  </div>

                  {/* Accommodation (listing-based quotes only — a custom quote
                      has no calendar, so it builds purely from custom lines). */}
                  {isCustomQuote ? null : scope === "rooms" ? (
                    pricedRooms.length > 0 ? (
                      pricedRooms.map((r) => (
                        <PriceRow
                          key={r.room_id}
                          title={
                            (listing?.rooms ?? []).find(
                              (x) => x.id === r.room_id,
                            )?.name ?? "Room"
                          }
                          sub={
                            nights > 0
                              ? `${formatMoney(Math.round(r.base_amount / nights), currency)} × ${nights} nights · editable`
                              : "Editable"
                          }
                          amount={
                            <RoomAmountInput
                              key={`${r.room_id}-${priceVersion}`}
                              initial={r.base_amount}
                              currency={currency}
                              onChange={(n) => setRoomBase(r.room_id, n)}
                            />
                          }
                        />
                      ))
                    ) : (
                      <p className="py-3 text-[12px] text-brand-mute">
                        Select rooms above — per-room amounts price from your
                        calendar.
                      </p>
                    )
                  ) : (
                    <PriceRow
                      title="Nightly rate"
                      sub={
                        nights > 0 && totals.base > 0
                          ? `${formatMoney(Math.round(totals.base / nights), currency)} × ${nights} nights`
                          : "Accommodation for the stay"
                      }
                      amount={
                        <AmountInput
                          value={baseAmount}
                          onChange={(v) => {
                            setBaseAmount(v);
                            setPricingTouched(true);
                          }}
                          currency={currency}
                        />
                      }
                    />
                  )}

                  {/* Cleaning (listing-based quotes only). */}
                  {isCustomQuote ? null : scope === "rooms" ? (
                    totals.cleaning > 0 ? (
                      <PriceRow
                        title="Cleaning fee"
                        sub="Per stay · from your rooms"
                        amount={
                          <StaticAmount
                            value={totals.cleaning}
                            currency={currency}
                          />
                        }
                      />
                    ) : null
                  ) : (
                    <PriceRow
                      title="Cleaning fee"
                      sub="One-off · per stay"
                      amount={
                        <AmountInput
                          value={cleaningFee}
                          onChange={(v) => {
                            setCleaningFee(v);
                            setPricingTouched(true);
                          }}
                          currency={currency}
                        />
                      }
                      onDelete={() => {
                        setCleaningFee("0");
                        setPricingTouched(true);
                      }}
                    />
                  )}

                  {/* Catalog add-ons */}
                  {catalogLines.map((a) => (
                    <PriceRow
                      key={a.addon_id}
                      title={a.label}
                      chip={a.quantity > 1 ? `× ${a.quantity}` : "Add-on"}
                      sub="From your add-on library"
                      amount={
                        <StaticAmount
                          value={a.quantity * a.unit_price}
                          currency={currency}
                        />
                      }
                      onDelete={() =>
                        setCatalogSel((p) => {
                          const next = { ...p };
                          delete next[a.addon_id];
                          return next;
                        })
                      }
                    />
                  ))}

                  {/* Custom lines */}
                  {customAddons.map((a, i) => (
                    <div
                      key={`custom-${i}`}
                      className="grid grid-cols-[1fr_120px_28px] items-center gap-2.5 border-b border-dashed border-brand-line py-2.5 last:border-0"
                    >
                      <Input
                        value={a.label}
                        onChange={(e) =>
                          updateCustom(i, { label: e.target.value })
                        }
                        placeholder="e.g. Early check-in"
                        className="h-9"
                      />
                      <AmountInput
                        value={a.unitPrice}
                        onChange={(v) =>
                          updateCustom(i, { unitPrice: v, quantity: "1" })
                        }
                        currency={currency}
                      />
                      <RowDelete onClick={() => removeCustom(i)} />
                    </div>
                  ))}

                  {/* Derived age/pet lines */}
                  {ageLines.map((a, i) => (
                    <PriceRow
                      key={`age-${i}`}
                      title={a.label}
                      sub="Priced from the guest party"
                      amount={
                        <StaticAmount value={a.subtotal} currency={currency} />
                      }
                    />
                  ))}

                  {/* Discount */}
                  {discountOn ? (
                    <PriceRow
                      title={discountReason.trim() || "Discount"}
                      chip={
                        discountType === "percent"
                          ? `${parseFloat(discountValue) || 0}%`
                          : "Fixed"
                      }
                      accent
                      amount={
                        <span className="block w-[120px] pr-2 text-right font-mono text-[13px] font-semibold text-brand-primary">
                          −{formatMoney(totals.discountAmount, currency)}
                        </span>
                      }
                      onDelete={() => setDiscountOn(false)}
                    />
                  ) : null}

                  {/* Add-line buttons */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
                    <AddBtn
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={addCustom}
                    >
                      Custom line
                    </AddBtn>
                    {listing && listing.addons.length > 0 ? (
                      <AddBtn
                        icon={<ListPlus className="h-3.5 w-3.5" />}
                        onClick={() => setAddCatalogOpen((v) => !v)}
                      >
                        Add-on from library
                      </AddBtn>
                    ) : null}
                    {!discountOn ? (
                      <AddBtn
                        icon={<Tag className="h-3.5 w-3.5" />}
                        onClick={() => setDiscountOn(true)}
                      >
                        Discount
                      </AddBtn>
                    ) : null}
                  </div>

                  {/* Catalog picker */}
                  {addCatalogOpen && listing ? (
                    <div className="mt-3 space-y-1.5 rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
                      {listing.addons.map((a) => {
                        const checked = catalogSel[a.id] != null;
                        return (
                          <label
                            key={a.id}
                            className="flex flex-wrap items-center gap-3 rounded-[8px] bg-white px-3 py-2 text-sm"
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
                              {formatMoney(a.unit_price, a.currency)} ·{" "}
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
                  ) : null}

                  {/* Discount editor */}
                  {discountOn ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
                      <div>
                        <FieldLabel>Type</FieldLabel>
                        <Seg
                          value={discountType}
                          onChange={(v) =>
                            setDiscountType(v as "percent" | "fixed")
                          }
                          options={[
                            { value: "percent", label: "%" },
                            {
                              value: "fixed",
                              label: currency === "ZAR" ? "R" : currency,
                            },
                          ]}
                        />
                      </div>
                      <div className="w-24">
                        <FieldLabel>Value</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                        />
                      </div>
                      <div className="min-w-[10rem] flex-1">
                        <FieldLabel>Reason</FieldLabel>
                        <Input
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder="Returning guest"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-[12px] border border-brand-line p-4">
                <FieldLabel>One price for the whole stay</FieldLabel>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-brand-mute">
                    {currency === "ZAR" ? "R" : currency}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={singleTotal}
                    onChange={(e) => setSingleTotal(e.target.value)}
                    className="w-full rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 font-mono text-[16px] font-bold text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
                  />
                </div>
                <p className="mt-2 text-[11.5px] text-brand-mute">
                  The guest sees a single total with no line-by-line breakdown.
                  Good for bespoke or negotiated pricing.
                </p>
              </div>
            )}

            {/* Auto-price failure — never leave the host on a silent R0. */}
            {priceError && datesValid && priceMode !== "single" ? (
              <div className="mt-4 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
                Couldn’t auto-price this stay — {priceError} Set a nightly rate
                on the listing for these dates, switch to per-room pricing, or
                enter an amount manually below.
              </div>
            ) : null}

            {/* Totals strip */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[12px] border border-brand-line bg-brand-light/40 px-4 py-3">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
                  Guest pays
                </div>
                <div className="mt-1 font-display text-[20px] font-bold text-brand-ink">
                  {formatMoney(totals.total, currency)}
                </div>
              </div>
              <div className="rounded-[12px] border border-brand-line bg-brand-light/40 px-4 py-3">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
                  Avg / night
                </div>
                <div className="mt-1 font-display text-[20px] font-bold text-brand-ink">
                  {nights > 0
                    ? formatMoney(Math.round(totals.total / nights), currency)
                    : "—"}
                </div>
              </div>
              <div className="rounded-[12px] border border-brand-primary/30 bg-brand-accent/40 px-4 py-3">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-secondary/80">
                  Your payout
                </div>
                <div className="mt-1 font-display text-[20px] font-bold text-brand-secondary">
                  {formatMoney(totals.total, currency)}
                </div>
                <div className="text-[10px] text-brand-secondary/70">
                  0% {brandName} fee · you keep it all
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {stepShow(2) && (
        <>
          {/* ===== STEP 3 — TERMS & REPLY ===== */}
          <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
            <SecHeader
              n={3}
              title="Terms &amp; your reply"
              sub="How long the offer stands, what they pay to lock it in, and a personal note."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Hold this price until</FieldLabel>
                <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-brand-line bg-brand-light/40 px-3">
                  <Clock className="h-4 w-4 text-brand-mute" />
                  <span className="text-[13px] font-medium text-brand-ink">
                    {validUntil}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <HoldPill
                    on={validDays === 1}
                    onClick={() => setValidDays(1)}
                  >
                    24 hours
                  </HoldPill>
                  <HoldPill
                    on={validDays === 3}
                    onClick={() => setValidDays(3)}
                  >
                    3 days
                  </HoldPill>
                  <HoldPill
                    on={validDays === 7}
                    onClick={() => setValidDays(7)}
                  >
                    7 days
                  </HoldPill>
                  {daysToCheckIn ? (
                    <HoldPill
                      on={validDays === daysToCheckIn}
                      onClick={() => setValidDays(daysToCheckIn)}
                    >
                      Until check-in
                    </HoldPill>
                  ) : null}
                </div>
              </div>
              <div>
                <FieldLabel>To accept, {firstName} pays</FieldLabel>
                <Seg
                  value={depositType}
                  onChange={(v) =>
                    setDepositType(v as "deposit" | "full" | "reserve")
                  }
                  options={[
                    { value: "deposit", label: "Deposit" },
                    { value: "full", label: "Full amount" },
                    { value: "reserve", label: "Reserve only" },
                  ]}
                />
                {depositType === "deposit" ? (
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div className="w-20">
                      <FieldLabel>Deposit %</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={depositPct}
                        onChange={(e) => setDepositPct(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={balanceDueDays}
                        onChange={(e) => setBalanceDueDays(e.target.value)}
                        className="w-16"
                      />
                      <span className="text-[11px] text-brand-mute">
                        days before check-in for the balance
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-brand-mute">
                    {depositType === "full"
                      ? "Guest pays the full amount to confirm."
                      : "Guest reserves the dates; you collect payment separately."}
                  </p>
                )}
              </div>
            </div>

            {/* Soft-hold note (sending soft-holds the dates automatically). */}
            <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-brand-ink">
                  Dates soft-held while {firstName} decides
                </div>
                <div className="text-[11px] text-brand-mute">
                  Sending marks{" "}
                  {datesValid
                    ? `${ci.dow} ${ci.day} – ${co.dow} ${co.day}`
                    : "the stay"}{" "}
                  as &ldquo;quote pending&rdquo; so you don&rsquo;t double-book.
                  It frees up if the quote expires or is declined.
                </div>
              </div>
            </div>

            {/* Reply message */}
            <div className="mt-5">
              <FieldLabel>Your reply to {firstName}</FieldLabel>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hi — here's a quote for your stay…"
                className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm leading-relaxed text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-brand-mute">
                  Quick inserts:
                </span>
                <Pill
                  onClick={() =>
                    insertSnippet(
                      "Check-in is from 14:00. I'll send directions and the key code the day before.",
                    )
                  }
                >
                  + Check-in details
                </Pill>
                <Pill
                  onClick={() =>
                    insertSnippet(
                      "Free cancellation up to 5 days before check-in; 50% refundable after that.",
                    )
                  }
                >
                  + Cancellation policy
                </Pill>
                <Pill
                  onClick={() =>
                    insertSnippet(
                      "I'll share full directions and parking details once your booking is confirmed.",
                    )
                  }
                >
                  + Directions
                </Pill>
              </div>
            </div>

            {/* Host brochure — upload ONCE, reuse on any quote. The guest can
                download it alongside the quote. */}
            <div className="mt-5 rounded-[12px] border border-brand-line bg-brand-light/20 p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <FileText className="h-4 w-4 text-brand-primary" />
                <span className="text-sm font-semibold text-brand-ink">
                  Brochure
                </span>
                <span className="text-[11px] text-brand-mute">
                  optional · guests can download it with your quote
                </span>
              </div>

              {brochure ? (
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-brand-ink">
                    <input
                      type="checkbox"
                      checked={attachBrochure}
                      onChange={(e) => setAttachBrochure(e.target.checked)}
                      className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
                    />
                    <span>
                      Include{" "}
                      <span className="font-medium">{brochure.name}</span>
                    </span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-brand-mute transition hover:text-brand-ink">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf"
                      className="hidden"
                      disabled={brochureUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleBrochureUpload(f);
                        e.target.value = "";
                      }}
                    />
                    <Paperclip className="h-3.5 w-3.5" />
                    {brochureUploading ? "Uploading…" : "Replace brochure"}
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleBrochureRemove()}
                    disabled={brochureUploading}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-mute transition hover:text-status-cancelled disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove brochure
                  </button>
                </div>
              ) : (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf"
                    className="hidden"
                    disabled={brochureUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleBrochureUpload(f);
                      e.target.value = "";
                    }}
                  />
                  <Paperclip className="h-4 w-4" />
                  {brochureUploading ? "Uploading…" : "Upload a brochure"}
                </label>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-brand-mute">
                Saved to your account — upload once, reuse on every quote. PDF
                or Word, up to 15 MB.
              </p>
            </div>
          </section>
        </>
      )}

      {isPage && step === 3 && (
        <div className="space-y-4">
          <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
            <SecHeader
              n={4}
              done={allReadyQ}
              title="Review &amp; send"
              sub="Check the quote, then save a draft or preview & send it to the guest."
            />
            <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-brand-line bg-brand-light/30 p-4">
              <QuoteRing pct={railPct} />
              <div className="min-w-0">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  {allReadyQ ? "Ready to send" : "Almost there"}
                </div>
                <div className="text-[12px] text-brand-mute">
                  {allReadyQ
                    ? "Everything the guest needs is set."
                    : "Finish the flagged steps first."}
                </div>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-[12px] border border-brand-line">
              <QRow
                label="Guest"
                value={
                  guestName.trim()
                    ? guestEmail
                      ? `${guestName} · ${guestEmail}`
                      : guestName
                    : "Not set"
                }
                muted={!guestName.trim()}
                onEdit={() => goToStep(0)}
              />
              {isCustomQuote ? (
                <QRow
                  label="Quote"
                  value={customTitle.trim() || "Not set"}
                  muted={!customTitle.trim()}
                  onEdit={() => goToStep(0)}
                />
              ) : (
                <>
                  <QRow
                    label="Listing"
                    value={listing?.name ?? "Not set"}
                    muted={!listing}
                    onEdit={() => goToStep(0)}
                  />
                  <QRow
                    label="Rooms"
                    value={roomScopeLabel}
                    onEdit={() => goToStep(0)}
                  />
                  <QRow
                    label="Dates"
                    value={
                      checkIn && checkOut
                        ? `${ci.day} ${ci.mo} → ${co.day} ${co.mo} · ${nights} night${nights === 1 ? "" : "s"}`
                        : "Not set"
                    }
                    muted={!(checkIn && checkOut)}
                    onEdit={() => goToStep(0)}
                  />
                  <QRow
                    label="Guests"
                    value={`${adults} adult${adults === 1 ? "" : "s"}${
                      children
                        ? ` · ${children} child${children === 1 ? "" : "ren"}`
                        : ""
                    }`}
                    onEdit={() => goToStep(0)}
                  />
                </>
              )}
              <QRow
                label="Price"
                value={priceMode === "single" ? "Single total" : "Itemised"}
                onEdit={() => goToStep(1)}
              />
              <QRow
                label="Deposit"
                value={`${formatMoney(deposit.due, currency)} · ${
                  depositType === "deposit"
                    ? `${parseFloat(depositPct) || 0}%`
                    : depositType
                }`}
                onEdit={() => goToStep(2)}
              />
              <QRow
                label="Valid until"
                value={validUntil}
                onEdit={() => goToStep(2)}
              />
              <QRow
                label="Total"
                value={formatMoney(totals.total, currency)}
                strong
                last
                onEdit={() => goToStep(1)}
              />
            </div>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[13px] border border-brand-line bg-brand-light/40 px-5 py-4">
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {allReadyQ
                  ? "Ready to send this quote"
                  : "A few details still needed"}
              </div>
              <div className="text-[12px] text-brand-mute">
                Save a draft, or preview exactly what the guest sees before
                sending.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={busy || hasDateConflict}
                className="rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-[13px] font-medium text-brand-ink hover:bg-brand-accent/40 disabled:opacity-60"
              >
                {pending && !sendingPending ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={openPreview}
                disabled={busy || hasDateConflict}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-5 py-2.5 text-[13px] font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary disabled:opacity-60"
              >
                <Eye className="h-4 w-4" /> Review &amp; send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const stickyBar = (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-line bg-white/95 backdrop-blur lg:left-64">
      <div className="mx-auto flex max-w-[880px] flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
              Quote total
            </div>
            <div className="font-display text-[20px] font-bold leading-none text-brand-ink">
              {formatMoney(totals.total, currency)}
            </div>
          </div>
          <div className="hidden h-9 w-px bg-brand-line sm:block" />
          <div className="hidden sm:block">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
              Your payout
            </div>
            <div className="font-display text-[14px] font-bold leading-none text-brand-secondary">
              {formatMoney(totals.total, currency)}{" "}
              <span className="text-[11px] font-medium text-brand-mute">
                · 0% fee
              </span>
            </div>
          </div>
          <div className="hidden h-9 w-px bg-brand-line sm:block" />
          <div className="hidden sm:block">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
              Due to accept
            </div>
            <div className="font-display text-[14px] font-bold leading-none text-brand-ink">
              {formatMoney(deposit.due, currency)}{" "}
              <span className="text-[11px] font-medium text-brand-mute">
                ·{" "}
                {depositType === "deposit"
                  ? `${parseFloat(depositPct) || 0}%`
                  : depositType === "reserve"
                    ? "reserve"
                    : "full"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={busy || hasDateConflict}
            title={
              hasDateConflict
                ? "Those dates are booked or blocked — pick open dates first."
                : undefined
            }
            className="rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-[13px] font-medium text-brand-ink hover:bg-brand-accent/40 disabled:opacity-60"
          >
            {pending && !sendingPending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={openPreview}
            disabled={busy || hasDateConflict}
            title={
              hasDateConflict
                ? "Those dates are booked or blocked — pick open dates first."
                : undefined
            }
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-5 py-2.5 text-[13px] font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary disabled:opacity-60"
          >
            <Eye className="h-4 w-4" />
            Review &amp; send
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isPage ? (
        <>
          {draft.hasDraft ? (
            <ResumeDraftBanner
              savedAt={draft.savedAt}
              onRestore={draft.restore}
              onDiscard={draft.discard}
              label="quote details"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[11px] border border-brand-line bg-brand-light text-brand-secondary">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-brand-mute">
                {initial?.id ? "Quotes · Editing" : "Quotes · New quote"}
              </div>
              <h1 className="mt-0.5 truncate font-display text-[19px] font-extrabold leading-none text-brand-ink">
                {guestName.trim()
                  ? `Quote for ${guestName.trim()}`
                  : "Build a quote"}
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <span className="hidden items-center gap-1.5 text-[12px] text-brand-mute md:inline-flex">
                {draft.status === "saving" ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                    Saving draft…
                  </>
                ) : draft.status === "saved" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-brand-primary" /> Draft
                    saved
                  </>
                ) : (
                  "Auto-saves as you go"
                )}
              </span>
              {totals.total > 0 && (
                <div className="text-right leading-none">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    Total
                  </div>
                  <div className="mt-1 font-display text-[16px] font-bold text-brand-ink">
                    {formatMoney(totals.total, currency)}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[300px_1fr]">
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <QuoteRail
                current={step}
                onGo={goToStep}
                done={railDone}
                sub={railSub}
                pct={railPct}
                ready={allReadyQ}
              />
            </aside>
            <div className="min-w-0">
              {sectionsInner}
              {step < 3 ? (
                <div className="mt-7 flex items-center justify-between gap-3 border-t border-brand-line pt-5">
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className={`inline-flex items-center gap-2 rounded-[11px] px-4 py-2.5 text-[14px] font-semibold text-brand-mute transition-colors hover:bg-brand-light ${
                      step === 0 ? "invisible" : ""
                    }`}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <div className="flex items-center gap-4">
                    <span className="hidden text-[13px] text-brand-mute sm:inline">
                      Step {step + 1} of 4
                    </span>
                    <button
                      type="button"
                      onClick={() => goToStep(step + 1)}
                      className="inline-flex items-center gap-2 rounded-[11px] bg-brand-primary px-6 py-3 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition-colors hover:bg-brand-secondary"
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-7 border-t border-brand-line pt-5">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-[11px] px-4 py-2.5 text-[14px] font-semibold text-brand-mute transition-colors hover:bg-brand-light"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {dividerLabel}
          {sectionsInner}
          {stickyBar}
        </>
      )}

      {/* ===== REVISION REASON PROMPT (editing a sent quote) ===== */}
      <FormModal
        open={reasonOpen}
        onOpenChange={(v) => {
          if (!busy) setReasonOpen(v);
        }}
        size="sm"
        title="Why are you revising this quote?"
        description="This quote was already sent. We'll keep the previous version and note the reason on the revised quote the guest sees."
      >
        <textarea
          rows={3}
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="e.g. Added the welcome hamper they asked for and adjusted the dates."
          className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm leading-relaxed text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
        />
        <FormModalFooter>
          <FormModalCancel>Cancel</FormModalCancel>
          <button
            type="button"
            onClick={confirmRevision}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
          >
            Save revision
          </button>
        </FormModalFooter>
      </FormModal>

      {/* ===== GUEST PREVIEW + SEND MODAL ===== */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setPreviewOpen(false)}
            className="absolute inset-0 bg-brand-dark/55 backdrop-blur-sm"
          />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
            <div className="relative my-auto w-full max-w-[540px] overflow-hidden rounded-card bg-white shadow-lift">
              <div className="flex items-center gap-2.5 border-b border-brand-line px-5 py-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
                  <Eye className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-brand-ink">
                    Preview before you send
                  </div>
                  <div className="text-[11.5px] text-brand-mute">
                    This is exactly what {firstName} will receive
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[64vh] overflow-y-auto bg-brand-light/50 p-4">
                {overCapacity && isLookingForResponse && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-card border border-amber-300 bg-amber-50 p-3">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-[13px] text-amber-800">
                      This is more guests ({partySize}) than{" "}
                      {listing?.name ?? "your place"} usually sleeps (
                      {capacityLimit}). You can still send this offer — just
                      make sure your reply explains how you&apos;d host the
                      group.
                    </p>
                  </div>
                )}
                <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                  {/* hero */}
                  <div className="relative bg-brand-gradient-dark p-5 text-white">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                        <Check className="h-3 w-3" /> Your quote
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-white/10 ring-2 ring-white/20">
                        {listing?.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={listing.coverUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-display text-[15px] font-semibold leading-tight">
                          {isCustomQuote
                            ? customTitle || "Custom quote"
                            : (listing?.name ?? "Your stay")}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-brand-accent/70">
                          {isCustomQuote ? "Custom quote" : roomScopeLabel}
                        </div>
                      </div>
                    </div>
                    {!isCustomQuote && (
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[10px] border border-white/10 bg-black/20 p-3">
                        <div className="text-center">
                          <div className="text-[9.5px] uppercase tracking-wider text-brand-accent/70">
                            Check-in
                          </div>
                          <div className="mt-1 font-display text-[18px] font-bold leading-none">
                            {ci.dow} {ci.day}
                          </div>
                          <div className="text-[10.5px] text-brand-accent/70">
                            {ci.mo}
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                            {nights} night{nights === 1 ? "" : "s"}
                          </span>
                          <ArrowRight className="mt-1 h-3 w-3 text-brand-primary" />
                        </div>
                        <div className="text-center">
                          <div className="text-[9.5px] uppercase tracking-wider text-brand-accent/70">
                            Check-out
                          </div>
                          <div className="mt-1 font-display text-[18px] font-bold leading-none">
                            {co.dow} {co.day}
                          </div>
                          <div className="text-[10.5px] text-brand-accent/70">
                            {co.mo}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-[11.5px]">
                      <User className="h-3.5 w-3.5 text-brand-primary" />
                      <span className="text-white">{guestName || "Guest"}</span>
                      <span className="text-brand-accent/50">·</span>
                      <span className="text-brand-accent/70">
                        {adults} adult{adults === 1 ? "" : "s"}
                        {children
                          ? ` · ${children} child${children === 1 ? "" : "ren"}`
                          : ""}
                        {pets ? ` · ${pets} pet${pets === 1 ? "" : "s"}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* host message */}
                  {notes.trim() ? (
                    <div className="px-5 pt-4">
                      <div className="rounded-[12px] rounded-tl-sm border border-brand-line bg-brand-light/50 p-3.5 text-[12.5px] leading-relaxed text-brand-ink">
                        {notes.trim()}
                      </div>
                    </div>
                  ) : null}

                  {/* breakdown */}
                  <ul className="space-y-2 px-5 pt-4 text-[12.5px]">
                    {guestLines.map((l, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-brand-mute">{l.label}</span>
                        <span className="font-mono font-medium text-brand-ink">
                          {formatMoney(l.amount, currency)}
                        </span>
                      </li>
                    ))}
                    {totals.discountAmount > 0 ? (
                      <li className="flex items-center justify-between text-brand-primary">
                        <span>
                          {discountReason.trim() || "Discount"}
                          {discountType === "percent"
                            ? ` · ${parseFloat(discountValue) || 0}%`
                            : ""}
                        </span>
                        <span className="font-mono font-medium">
                          −{formatMoney(totals.discountAmount, currency)}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                  <div className="mx-5 my-4 h-px bg-brand-line" />
                  <div className="flex items-baseline justify-between px-5">
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
                        Quote total
                      </div>
                      <div className="mt-1 font-display text-[26px] font-bold leading-none text-brand-ink">
                        {formatMoney(totals.total, currency)}
                      </div>
                    </div>
                    {nights > 0 ? (
                      <div className="text-right">
                        <div className="text-[10.5px] text-brand-mute">
                          avg / night
                        </div>
                        <div className="font-display text-[14px] font-bold text-brand-ink">
                          {formatMoney(
                            Math.round(totals.total / nights),
                            currency,
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 border-t border-brand-line p-4">
                    <div className="pointer-events-none flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-4 py-3 text-[14px] font-semibold text-white">
                      {depositType === "reserve"
                        ? "Reserve these dates"
                        : `Accept & pay ${formatMoney(deposit.due, currency)}${depositType === "deposit" ? " deposit" : ""}`}
                    </div>
                    <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-brand-mute">
                      <Lock className="h-3 w-3" />
                      Secure payment · valid until {validUntil}
                      {deposit.balance > 0
                        ? ` · balance due ${balanceDueDays} days before check-in`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* footer actions */}
              <div className="flex items-center gap-2 border-t border-brand-line bg-white p-4">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-accent/40"
                >
                  ← Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(false);
                    save(true);
                  }}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary disabled:opacity-60"
                >
                  {sendingPending ? "Sending…" : `Send to ${firstName}`}
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ── Small presentational helpers ───────────────────────────────────
// ── Left-rail step navigator (page variant) ──────────────────────────────
function QuoteRail({
  current,
  onGo,
  done,
  sub,
  pct,
  ready,
}: {
  current: number;
  onGo: (i: number) => void;
  done: boolean[];
  sub: string[];
  pct: number;
  ready: boolean;
}) {
  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card">
        <QuoteRing pct={pct} />
        <div className="min-w-0">
          <div className="font-display text-[14px] font-bold text-brand-ink">
            {ready ? "Ready to send" : "In progress"}
          </div>
          <div className="text-[11px] text-brand-mute">
            {ready ? "Review and send" : "Work through the steps"}
          </div>
        </div>
      </div>
      <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        Steps
      </div>
      <div className="space-y-1">
        {QUOTE_STEPS.map((label, i) => {
          const Icon = QUOTE_STEP_ICONS[i];
          const active = i === current;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onGo(i)}
              aria-current={active ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                active
                  ? "border-brand-line bg-white shadow-card"
                  : "border-transparent hover:bg-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
                  active
                    ? "bg-brand-primary text-white"
                    : "bg-brand-accent/70 text-brand-secondary"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[13.5px] font-semibold leading-tight ${
                    active ? "text-brand-ink" : "text-brand-ink/80"
                  }`}
                >
                  {label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                  {sub[i]}
                </span>
              </span>
              {done[i] ? (
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function QuoteRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#E4EFE8"
          strokeWidth="3.4"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[11.5px] font-bold tabular-nums text-brand-ink">
        {pct}%
      </div>
    </div>
  );
}

function QRow({
  label,
  value,
  muted,
  strong,
  last,
  onEdit,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  last?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${
        last ? "" : "border-b border-[#EEF4F0]"
      } ${strong ? "bg-brand-light/40" : ""}`}
    >
      <div className="w-[86px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-[13px] ${
          muted
            ? "italic text-brand-mute"
            : strong
              ? "font-display font-bold text-brand-ink"
              : "font-medium text-brand-ink"
        }`}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-mute transition hover:border-brand-primary/40 hover:text-brand-ink"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}

function SecHeader({
  n,
  title,
  sub,
  done,
  right,
}: {
  n: number;
  title: string;
  sub: string;
  done?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold ${done ? "bg-brand-primary text-white" : "bg-brand-secondary text-brand-accent"}`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[17px] font-bold text-brand-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-brand-mute">{sub}</p>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold text-brand-mute">
      {children}
    </label>
  );
}

type GuestHit = {
  name: string;
  email: string;
  phone: string | null;
  stays: number;
};

// Explicit "pull in an existing guest" search at the top of the Guest section.
// Searches past bookers + the Guests directory and fills name/email/phone on
// pick. Self-contained so it doesn't tangle with the name-field autocomplete.
function ExistingGuestPicker({
  onPick,
}: {
  onPick: (g: { name: string; email: string; phone: string | null }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GuestHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const r = await searchGuestsAction(v);
      setSearching(false);
      if (r.ok && r.data) {
        setResults(r.data);
        setOpen(true);
      }
    }, 250);
  }

  return (
    <div className="relative">
      <FieldLabel>Pull in an existing guest</FieldLabel>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
        <Input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search past guests by name or email…"
          className="pl-9"
        />
      </div>
      {open && results.length > 0 ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-brand-line bg-white shadow-lift">
          {results.map((g) => (
            <button
              key={g.email}
              type="button"
              onMouseDown={() => {
                onPick(g);
                setQ("");
                setResults([]);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-accent/40"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-bold text-white">
                {(g.name || g.email)[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-brand-ink">
                  {g.name || g.email}
                </span>
                <span className="block truncate text-xs text-brand-mute">
                  {g.email}
                </span>
              </span>
              {g.stays > 0 ? (
                <span className="shrink-0 rounded-pill bg-brand-accent px-1.5 py-0.5 text-[10px] font-semibold text-brand-secondary">
                  {g.stays} stay{g.stays === 1 ? "" : "s"}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : q.trim().length >= 2 && !searching && results.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-brand-mute">
          No match — type the guest&rsquo;s details below to add them.
        </p>
      ) : null}
    </div>
  );
}

function PriceRow({
  title,
  sub,
  chip,
  amount,
  accent,
  onDelete,
}: {
  title: string;
  sub?: string;
  chip?: string;
  amount: React.ReactNode;
  accent?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_120px_28px] items-center gap-2.5 border-b border-dashed border-brand-line py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[13px] font-semibold ${accent ? "text-brand-primary" : "text-brand-ink"}`}
          >
            {title}
          </span>
          {chip ? (
            <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-mute">
              {chip}
            </span>
          ) : null}
        </div>
        {sub ? <div className="text-[11px] text-brand-mute">{sub}</div> : null}
      </div>
      {amount}
      {onDelete ? <RowDelete onClick={onDelete} /> : <span />}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  currency,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: string;
}) {
  return (
    <div className="relative w-[120px] justify-self-end">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-brand-mute">
        {currency === "ZAR" ? "R" : currency}
      </span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus:ring-brand-primary/12 w-full rounded-[8px] border border-brand-line bg-white py-1.5 pl-7 pr-2 text-right font-mono text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2"
      />
    </div>
  );
}

// Editable per-room amount. Holds its own text buffer (seeded from the priced
// value) so the host can type freely; the parent is remounted via `key` when a
// fresh calendar price should replace the override.
function RoomAmountInput({
  initial,
  currency,
  onChange,
}: {
  initial: number;
  currency: string;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(initial));
  return (
    <div className="relative w-[120px] justify-self-end">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-brand-mute">
        {currency === "ZAR" ? "R" : currency}
      </span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const n = parseFloat(v);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="focus:ring-brand-primary/12 w-full rounded-[8px] border border-brand-line bg-white py-1.5 pl-7 pr-2 text-right font-mono text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2"
      />
    </div>
  );
}

function StaticAmount({
  value,
  currency,
}: {
  value: number;
  currency: string;
}) {
  return (
    <span className="block w-[120px] justify-self-end pr-2 text-right font-mono text-[13px] font-medium text-brand-ink">
      {formatMoney(value, currency)}
    </span>
  );
}

function RowDelete({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove line"
      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-brand-mute transition-colors hover:bg-status-cancelled/10 hover:text-status-cancelled"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function AddBtn({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-brand-line bg-white px-3 py-1.5 text-[12px] font-medium text-brand-ink hover:bg-brand-accent/40"
    >
      <span className="text-brand-primary">{icon}</span>
      {children}
    </button>
  );
}

function Chip({
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
      className={`rounded-pill px-4 py-1.5 text-sm font-medium transition ${active ? "bg-brand-primary text-white" : "border border-brand-line bg-white text-brand-mute hover:text-brand-ink"}`}
    >
      {label}
    </button>
  );
}

function Pill({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
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

function HoldPill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold transition ${on ? "bg-brand-accent text-brand-secondary" : "border border-brand-line bg-white text-brand-ink hover:bg-brand-accent/40"}`}
    >
      {children}
    </button>
  );
}

function Seg({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex w-full rounded-[10px] border border-brand-line bg-brand-light p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[7px] px-2 py-1.5 text-[12px] font-medium transition ${value === o.value ? "bg-white font-semibold text-brand-ink shadow-card" : "text-brand-mute hover:text-brand-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  const atMax = max != null && value >= max;
  return (
    <div className="flex items-center justify-between rounded-[10px] border border-brand-line bg-white p-3">
      <div>
        <div className="text-[12.5px] font-semibold text-brand-ink">
          {label}
        </div>
        <div className="text-[10.5px] text-brand-mute">{hint}</div>
      </div>
      <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-brand-line bg-white">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-7 items-center justify-center text-brand-mute hover:bg-brand-accent/40 disabled:text-brand-line"
        >
          −
        </button>
        <span className="w-7 text-center text-[13px] font-semibold text-brand-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={() => !atMax && onChange(value + 1)}
          disabled={atMax}
          className="flex h-8 w-7 items-center justify-center text-brand-mute hover:bg-brand-accent/40 disabled:text-brand-line"
        >
          +
        </button>
      </div>
    </div>
  );
}
