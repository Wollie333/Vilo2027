"use client";

import {
  ArrowRight,
  BedDouble,
  Calculator,
  Check,
  Clock,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  User,
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

import { Input } from "@/components/ui/input";

import { QuoteCalendar } from "./QuoteCalendar";
import {
  createQuoteAction,
  priceQuoteAction,
  searchGuestsAction,
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
};

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const f = new Date(`${checkIn}T00:00:00Z`).getTime();
  const t = new Date(`${checkOut}T00:00:00Z`).getTime();
  const n = Math.round((t - f) / 86_400_000);
  return n > 0 ? n : 0;
}

function fmtDayLong(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmt(amount: number, currency: string): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  return `${symbol} ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
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
          guests: headcount,
          rooms: chosenRooms,
          party: { children, infants, pets },
        });
        if (!r.ok || !r.data) {
          if (!silent)
            toast.error(r.ok ? "Could not price this stay." : r.error);
          return;
        }
        if (scope === "rooms") setPricedRooms(r.data.rooms);
        else {
          setBaseAmount(String(r.data.base_amount));
          setCleaningFee(String(r.data.cleaning_fee));
        }
        setAgeLines(r.data.age_lines);
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
    ],
  );

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

  function buildInput() {
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
      listing_id: listingId,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      guest_phone: guestPhone.trim(),
      check_in: checkIn,
      check_out: checkOut,
      headcount,
      scope,
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
      notes: notes.trim(),
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

  function save(sendAfter: boolean) {
    const input = buildInput();
    if (!input.listing_id) return toast.error("Pick a listing.");
    if (!input.guest_name || !input.guest_email)
      return toast.error("Add the guest's name and email.");
    if (input.scope === "rooms" && input.rooms.length === 0)
      return toast.error("Select rooms and price them first.");

    if (initial?.id) {
      start(async () => {
        const result = await updateQuoteAction(initial.id!, input);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (sendAfter) {
          startSending(async () => {
            const r = await sendQuoteAction(initial.id!, validDays);
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

  const busy = pending || sendingPending || pricing;
  const validUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + validDays);
    return d.toLocaleDateString("en-ZA", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }, [validDays]);

  const selectedRoomObjs = (listing?.rooms ?? []).filter(
    (r) => selectedRooms[r.id],
  );

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* LEFT COLUMN */}
      <div className="space-y-5">
        {/* 1 — Lead guest */}
        <Section
          n={1}
          title="Who is this for?"
          sub="The guest who'll receive the quote — Vilo searches your past guests as you type."
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
                  { value: "email", label: "Email only" },
                  { value: "link", label: "Link" },
                ]}
              />
            </div>
          </div>
        </Section>

        {/* 2 — Listing & room */}
        <Section
          n={2}
          title="Listing & room"
          sub="What are you quoting on? Nightly rates fill in automatically."
        >
          <div className="grid gap-3 sm:grid-cols-3">
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
                        {l.max_guests ? ` · sleeps ${l.max_guests}` : ""}
                      </span>
                    </span>
                    {l.base_price != null ? (
                      <span className="text-right">
                        <span className="block font-display text-[12.5px] font-bold text-brand-ink">
                          {fmt(l.base_price, l.currency)}
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

          {hasRooms ? (
            <div className="mt-4">
              <FieldLabel>Quoting</FieldLabel>
              <div className="mt-1 flex gap-2">
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
                    const priced = pricedRooms.find((p) => p.room_id === r.id);
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
                            {r.max_guests ? `sleeps ${r.max_guests}` : ""}
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
                                {fmt(
                                  priced.base_amount + priced.cleaning_fee,
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
        </Section>

        {/* 3 — Dates */}
        <Section
          n={3}
          title="Stay dates"
          sub="Hatched cells are already booked. Dates aren't held until the guest accepts."
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
            <div>
              <FieldLabel>Check-in</FieldLabel>
              <div className="flex h-[38px] items-center rounded-[10px] border border-brand-line bg-white px-3 text-[13px] text-brand-ink">
                {checkIn ? fmtDayLong(checkIn) : "Pick a date"}
              </div>
            </div>
            <div>
              <FieldLabel>Check-out</FieldLabel>
              <div className="flex h-[38px] items-center rounded-[10px] border border-brand-line bg-white px-3 text-[13px] text-brand-ink">
                {checkOut ? fmtDayLong(checkOut) : "Pick a date"}
              </div>
            </div>
            <div>
              <FieldLabel>Nights</FieldLabel>
              <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-brand-line bg-brand-light/50 px-3">
                <span className="font-display text-[18px] font-bold text-brand-ink">
                  {nights}
                </span>
                <span className="text-[11px] text-brand-mute">nights</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-brand-mute">
              Quick add:
            </span>
            <Pill onClick={() => quickDates(2, true)}>This weekend</Pill>
            <Pill onClick={() => quickDates(3, true)}>Long weekend</Pill>
            <Pill onClick={() => quickDates(7, false)}>7 nights</Pill>
          </div>
          <div className="mt-4">
            <QuoteCalendar
              checkIn={checkIn}
              checkOut={checkOut}
              blocked={blockedSet}
              onChange={(ci, co) => {
                setCheckIn(ci);
                setCheckOut(co);
              }}
            />
          </div>
        </Section>

        {/* 4 — Guest party */}
        <Section
          n={4}
          title="Guest party"
          sub={
            listing?.max_guests
              ? `${listing.name} sleeps ${listing.max_guests}.`
              : "Who's coming along."
          }
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <Stepper
              label="Adults"
              hint="13 +"
              value={adults}
              min={1}
              onChange={setAdults}
            />
            {allow.children ? (
              <Stepper
                label="Children"
                hint="2 – 12"
                value={children}
                min={0}
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
        </Section>

        {/* 5 — Pricing */}
        <Section
          n={5}
          title="Pricing"
          sub="Priced from your calendar — tweak any line or add charges. Guests see exactly this."
          accent
        >
          <button
            type="button"
            onClick={() => priceStayNow(false)}
            disabled={busy || !datesValid}
            className="mb-3 inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-accent/40 disabled:opacity-50"
          >
            <Calculator className="h-4 w-4" />
            {pricing ? "Pricing…" : "Re-price from calendar"}
          </button>
          {!datesValid ? (
            <span className="ml-2 text-xs text-brand-mute">
              Add dates above to price.
            </span>
          ) : null}

          {scope === "whole_listing" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>{`Accommodation (${currency})`}</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>{`Cleaning fee (${currency})`}</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-brand-mute">
              Per-room amounts come from your calendar once rooms are priced
              above.
            </p>
          )}

          {listing && listing.addons.length > 0 ? (
            <div className="mt-4">
              <FieldLabel>Add-ons from your catalog</FieldLabel>
              <div className="mt-2 space-y-1.5">
                {listing.addons.map((a) => {
                  const checked = catalogSel[a.id] != null;
                  return (
                    <label
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm"
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

          <div className="mt-4">
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
                  <button
                    type="button"
                    onClick={() => removeCustom(i)}
                    aria-label="Remove line"
                    className="flex items-center justify-center rounded-[8px] border border-brand-line text-brand-mute hover:bg-red-50 hover:text-status-cancelled"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCustom}
              className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-brand-line bg-white px-3 py-1.5 text-[12px] font-medium text-brand-ink hover:bg-brand-accent/40"
            >
              <Plus className="h-3.5 w-3.5 text-brand-primary" /> Custom line
            </button>
          </div>

          {/* Discount */}
          <div className="mt-4 rounded-[10px] border border-brand-line bg-brand-light/50 p-3">
            <label className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDiscountOn((v) => !v)}
                aria-pressed={discountOn}
                className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${discountOn ? "bg-brand-primary" : "bg-brand-line"}`}
              >
                <span
                  className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${discountOn ? "translate-x-[16px]" : "translate-x-[2px]"}`}
                />
              </button>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-brand-ink">
                  Apply a discount
                </span>
                <span className="block text-[11px] text-brand-mute">
                  Shown as its own line on the quote.
                </span>
              </span>
            </label>
            {discountOn ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <Seg
                    value={discountType}
                    onChange={(v) => setDiscountType(v as "percent" | "fixed")}
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
                {totals.discountAmount > 0 ? (
                  <span className="pb-2 text-[12px] font-medium text-brand-primary">
                    −{fmt(totals.discountAmount, currency)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[10px] bg-brand-accent/40 px-4 py-3">
            <span className="text-[12px] text-brand-secondary">
              Accommodation {fmt(totals.base, currency)} · cleaning{" "}
              {fmt(totals.cleaning, currency)} · add-ons{" "}
              {fmt(totals.addonsSum, currency)}
              {totals.discountAmount > 0
                ? ` · −${fmt(totals.discountAmount, currency)}`
                : ""}
            </span>
            <span className="font-display text-[15px] font-bold text-brand-secondary">
              Total {fmt(totals.total, currency)}
            </span>
          </div>
        </Section>

        {/* 6 — Quote settings (validity; deposit lands in Phase 2) */}
        <Section
          n={6}
          title="Quote settings"
          sub="How long the offer stands and what the guest pays to lock it in."
        >
          <FieldLabel>Valid for</FieldLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[1, 3, 7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setValidDays(d)}
                className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${validDays === d ? "bg-brand-accent text-brand-secondary" : "border border-brand-line bg-white text-brand-ink hover:bg-brand-accent/40"}`}
              >
                {d === 1 ? "24 hours" : `${d} days`}
              </button>
            ))}
            <span className="ml-1 inline-flex items-center text-[11px] text-brand-mute">
              Expires {validUntil}
            </span>
          </div>

          <div className="mt-4">
            <FieldLabel>To accept, guest pays</FieldLabel>
            <div className="mt-1">
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
            </div>
            {depositType === "deposit" ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
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
                <div className="w-28">
                  <FieldLabel>Balance due</FieldLabel>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={balanceDueDays}
                      onChange={(e) => setBalanceDueDays(e.target.value)}
                      className="w-16"
                    />
                    <span className="text-[11px] text-brand-mute">
                      days before
                    </span>
                  </div>
                </div>
                <span className="pb-2 text-[12px] text-brand-mute">
                  Due now{" "}
                  <span className="font-semibold text-brand-ink">
                    {fmt(deposit.due, currency)}
                  </span>{" "}
                  · balance {fmt(deposit.balance, currency)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-brand-mute">
                {depositType === "full"
                  ? "Guest pays the full amount to confirm."
                  : "Guest reserves the dates; you collect payment separately."}
              </p>
            )}
          </div>
        </Section>

        {/* 7 — Message */}
        <Section
          n={7}
          title="Message to guest"
          sub="A short personal note. This appears above the quote."
        >
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hi — here's a quote for your stay…"
            className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
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
          </div>
        </Section>
      </div>

      {/* RIGHT COLUMN — sticky summary */}
      <aside className="lg:sticky lg:top-[88px] lg:self-start">
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-lift">
          <div className="relative bg-brand-gradient-dark p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-status-draft" />{" "}
                {initial?.id ? "Editing" : "New quote"}
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
                  {listing?.name ?? "Pick a listing"}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-brand-accent/70">
                  {scope === "rooms"
                    ? selectedRoomObjs.map((r) => r.name).join(", ") ||
                      "Select rooms"
                    : "Whole listing"}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[10px] border border-white/10 bg-black/20 p-3">
              <div className="text-center">
                <div className="text-[9.5px] uppercase tracking-wider text-brand-accent/70">
                  Check-in
                </div>
                <div className="mt-1 font-display text-[15px] font-bold leading-none">
                  {checkIn ? fmtDayLong(checkIn).slice(0, 6) : "—"}
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
                <div className="mt-1 font-display text-[15px] font-bold leading-none">
                  {checkOut ? fmtDayLong(checkOut).slice(0, 6) : "—"}
                </div>
              </div>
            </div>
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

          <div className="px-5 pt-5 text-[12.5px]">
            <ul className="space-y-2">
              <SumRow
                label="Accommodation"
                value={fmt(totals.base, currency)}
              />
              {totals.cleaning > 0 ? (
                <SumRow
                  label="Cleaning fee"
                  value={fmt(totals.cleaning, currency)}
                />
              ) : null}
              {catalogLines.map((a, i) => (
                <SumRow
                  key={`c${i}`}
                  label={a.label}
                  value={fmt(a.quantity * a.unit_price, currency)}
                />
              ))}
              {customAddons
                .filter((a) => a.label.trim())
                .map((a, i) => (
                  <SumRow
                    key={`x${i}`}
                    label={a.label}
                    value={fmt(
                      (parseFloat(a.quantity) || 0) *
                        (parseFloat(a.unitPrice) || 0),
                      currency,
                    )}
                  />
                ))}
              {ageLines.map((a, i) => (
                <SumRow
                  key={`a${i}`}
                  label={a.label}
                  value={fmt(a.subtotal, currency)}
                />
              ))}
              {totals.discountAmount > 0 ? (
                <li className="flex items-center justify-between">
                  <span className="text-brand-primary">
                    {discountReason.trim() || "Discount"}
                    {discountType === "percent"
                      ? ` · ${parseFloat(discountValue) || 0}%`
                      : ""}
                  </span>
                  <span className="font-medium text-brand-primary">
                    −{fmt(totals.discountAmount, currency)}
                  </span>
                </li>
              ) : null}
            </ul>
            <div className="my-4 h-px bg-brand-line" />
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
                  Quote total
                </div>
                <div className="mt-1 font-display text-[26px] font-bold leading-none text-brand-ink">
                  {fmt(totals.total, currency)}
                </div>
              </div>
              {nights > 0 ? (
                <div className="text-right">
                  <div className="text-[10.5px] text-brand-mute">
                    avg / night
                  </div>
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {fmt(totals.total / nights, currency)}
                  </div>
                </div>
              ) : null}
            </div>
            {depositType !== "full" ? (
              <div className="mt-4 rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold text-brand-secondary">
                    {depositType === "reserve"
                      ? "To reserve"
                      : `Due to accept (${parseFloat(depositPct) || 0}%)`}
                  </span>
                  <span className="font-display text-[16px] font-bold text-brand-secondary">
                    {fmt(deposit.due, currency)}
                  </span>
                </div>
                {deposit.balance > 0 ? (
                  <div className="mt-0.5 text-[10.5px] text-brand-mute">
                    Balance {fmt(deposit.balance, currency)} due{" "}
                    {balanceDueDays} days before check-in
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-status-pending/30 bg-status-pending/10 px-3 py-2.5">
              <Clock className="h-4 w-4 shrink-0 text-status-pending" />
              <span className="text-[11.5px] text-brand-ink">
                Valid until <span className="font-semibold">{validUntil}</span>{" "}
                · {validDays} day{validDays === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-4 pb-5">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-mute">
                What happens next
              </div>
              <ol className="space-y-2 text-[11.5px]">
                <NextStep n={1} active>
                  Guest gets the quote by{" "}
                  {sendVia === "email"
                    ? "email"
                    : sendVia === "link"
                      ? "a link"
                      : "email + WhatsApp"}
                </NextStep>
                <NextStep n={2}>They accept &amp; pay online</NextStep>
                <NextStep n={3}>
                  Vilo confirms the booking &amp; blocks the calendar
                </NextStep>
              </ol>
            </div>
          </div>

          <div className="space-y-2 border-t border-brand-line bg-white p-4">
            <button
              type="button"
              onClick={() => save(true)}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-4 py-3 text-[14px] font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary disabled:opacity-60"
            >
              {sendingPending
                ? "Sending…"
                : initial?.id
                  ? "Save & send"
                  : `Send quote${guestName ? ` to ${guestName.split(" ")[0]}` : ""}`}
              <Send className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy}
              className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12px] font-medium text-brand-ink hover:bg-brand-accent/40 disabled:opacity-60"
            >
              {pending && !sendingPending ? "Saving…" : "Save draft"}
            </button>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[10.5px] text-brand-mute">
              <ShieldCheck className="h-3 w-3" /> No charge until the guest
              accepts &amp; pays
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── Small presentational helpers ───────────────────────────────────
function Section({
  n,
  title,
  sub,
  accent,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-card border bg-white p-6 shadow-card ${accent ? "border-brand-primary/30 ring-1 ring-brand-primary/10" : "border-brand-line"}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-secondary font-display text-[11px] font-bold text-brand-accent">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-bold text-brand-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-brand-mute">{sub}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold text-brand-mute">
      {children}
    </label>
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
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[10px] border border-brand-line p-3">
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
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-7 items-center justify-center text-brand-mute hover:bg-brand-accent/40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-brand-mute">{label}</span>
      <span className="font-medium text-brand-ink">{value}</span>
    </li>
  );
}

function NextStep({
  n,
  active,
  children,
}: {
  n: number;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${active ? "bg-brand-primary text-white" : "bg-brand-line text-brand-mute"}`}
      >
        {n}
      </span>
      <span className={active ? "text-brand-ink" : "text-brand-mute"}>
        {children}
      </span>
    </li>
  );
}
