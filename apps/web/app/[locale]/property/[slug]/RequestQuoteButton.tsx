"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  HelpCircle,
  Home,
  Loader2,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VLogo } from "@/app/_components/home/VLogo";
import { DateRangePicker } from "@/components/ui/date-picker";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CheckoutDateEditor } from "./book/CheckoutDateEditor";

// Radix Select forbids an empty-string value, so use sentinels for the
// "whole listing" and "not sure — host to recommend" choices.
const WHOLE_PLACE = "__whole__";
const UNSURE = "__unsure__";

type RoomOption = { id: string; name: string; maxGuests: number };

// Room-selection intent for the quote. Maps to the enquiry scope:
//   rooms  → scope "rooms" + the chosen room_ids
//   whole  → scope "whole_listing" (the host quote pre-selects the whole place)
//   unsure → scope "whole_listing" too, but a "please pick the room" flag is
//            prepended to the host thread so the host chooses when finalising.
type RoomIntent = "rooms" | "whole" | "unsure";

export function RequestQuoteButton({
  listingId,
  listingName,
  bookingMode,
  rooms,
  initialCheckIn = "",
  initialCheckOut = "",
  isAuthed = false,
  prefillName = "",
  prefillEmail = "",
  prefillPhone = "",
  triggerClassName,
  triggerLabel = "Request a quote",
  fullscreen = false,
  hostName = null,
  hostAvatarUrl = null,
  listingTypeLabel = "Stay",
  listingCity = null,
  coverImageUrl = null,
  unavailableDates,
}: {
  listingId: string;
  listingName: string;
  bookingMode: "whole_listing" | "rooms_only" | "flexible";
  rooms: RoomOption[];
  initialCheckIn?: string;
  initialCheckOut?: string;
  // When the visitor is signed in we prefill (and hide) the contact fields and
  // submit their session details, so the enquiry matches their existing account.
  isAuthed?: boolean;
  prefillName?: string;
  prefillEmail?: string;
  prefillPhone?: string;
  // Lets callers restyle the trigger (e.g. full-width secondary on the dark
  // reserve panel, or a compact button on the mobile bar).
  triggerClassName?: string;
  triggerLabel?: string;
  // MOBILE: render the request as a dedicated full-viewport wizard that mirrors
  // the checkout flow (host header → one decision per screen → send), instead of
  // the desktop FormModal. Set only on the mobile-bar instance.
  fullscreen?: boolean;
  // Host-header context for the fullscreen wizard (matches the checkout header).
  hostName?: string | null;
  hostAvatarUrl?: string | null;
  listingTypeLabel?: string;
  listingCity?: string | null;
  coverImageUrl?: string | null;
  // Whole-listing booked/blocked dates — greyed light-yellow + unselectable in
  // the wizard calendar, exactly as in checkout, so a guest can't request a
  // quote for dates that are already taken.
  unavailableDates?: string[];
}) {
  const [open, setOpen] = useState(false);
  // Current screen in the fullscreen (mobile) wizard. Ignored on desktop.
  const [qIndex, setQIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  // True while a real page navigation is under way — keeps the spinner up so
  // the form never flashes back before the next page loads.
  const [navigating, setNavigating] = useState(false);
  // What the enquiry returned — drives the in-place thank-you / create-account
  // prompt without bouncing the guest off the page.
  const [sent, setSent] = useState<{
    isLead: boolean;
    email: string;
    conversationId?: string;
    redirectTo?: string;
  } | null>(null);

  const roomsPickable = bookingMode !== "whole_listing" && rooms.length > 0;

  // Lock the page behind the fullscreen (mobile) wizard so the listing doesn't
  // scroll under the overlay (matches the Radix dialog's behaviour on desktop).
  useEffect(() => {
    if (!fullscreen || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen, open]);

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  // Today (local) — the earliest a guest can request. Lazy so it's stable and
  // never reads Date during SSR of the closed trigger.
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [name, setName] = useState(prefillName);
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState(prefillPhone);
  const [hp, setHp] = useState(""); // honeypot

  // Room-selection intent. Default: a flexible listing quotes the whole place
  // (its historical default); a rooms-only listing starts on room selection.
  const [roomIntent, setRoomIntent] = useState<RoomIntent>(() =>
    roomsPickable ? (bookingMode === "flexible" ? "whole" : "rooms") : "whole",
  );
  // Whether the guest has touched the room selection — once they have, the
  // party-size auto-fit stops overriding their choice.
  const [roomsTouched, setRoomsTouched] = useState(false);

  const partySize = adults + children;
  // Fewest rooms (largest first) whose combined capacity covers the party.
  function autoFitRoomIds(party: number): string[] {
    const sorted = [...rooms].sort((a, b) => b.maxGuests - a.maxGuests);
    const pick: string[] = [];
    let cap = 0;
    for (const r of sorted) {
      if (cap >= party) break;
      pick.push(r.id);
      cap += Math.max(1, r.maxGuests);
    }
    if (pick.length === 0 && sorted[0]) pick.push(sorted[0].id);
    return pick;
  }
  // MOBILE wizard only: when on "rooms" intent and the guest hasn't manually
  // picked, keep the selection sized to the party (e.g. 4 guests → two 2-bed
  // rooms selected by default). Desktop keeps its single-select dropdown.
  useEffect(() => {
    if (!fullscreen || !open) return;
    if (roomIntent !== "rooms" || roomsTouched) return;
    setSelectedRooms(autoFitRoomIds(partySize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, open, roomIntent, roomsTouched, partySize]);

  const selectedCapacity = rooms
    .filter((r) => selectedRooms.includes(r.id))
    .reduce((s, r) => s + Math.max(1, r.maxGuests), 0);
  // Picked rooms sleep fewer than the party — a warning, not a hard block.
  const roomShort =
    roomIntent === "rooms" &&
    selectedRooms.length > 0 &&
    selectedCapacity < partySize;

  // Tap a room card: switch to room intent and toggle it (start fresh if the
  // guest was on whole-listing / not-sure).
  function toggleRoomCard(id: string) {
    setRoomsTouched(true);
    if (roomIntent !== "rooms") {
      setRoomIntent("rooms");
      setSelectedRooms([id]);
      return;
    }
    setSelectedRooms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function reset() {
    setDone(false);
    setNavigating(false);
    setSent(null);
    setQIndex(0);
    setCheckIn(initialCheckIn);
    setCheckOut(initialCheckOut);
    setAdults(2);
    setChildren(0);
    setInfants(0);
    setPets(0);
    setSelectedRooms([]);
    setRoomIntent(
      roomsPickable
        ? bookingMode === "flexible"
          ? "whole"
          : "rooms"
        : "whole",
    );
    setRoomsTouched(false);
    setMessage("");
    setName(prefillName);
    setEmail(prefillEmail);
    setPhone(prefillPhone);
    setHp("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitQuote();
  }

  async function submitQuote() {
    if (pending) return;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      toast.error("Pick valid check-in and check-out dates.");
      return;
    }
    if (roomIntent === "rooms" && selectedRooms.length === 0) {
      toast.error("Pick at least one room, the whole listing, or “Not sure”.");
      return;
    }
    // Map the room intent to the enquiry scope. "Not sure" pins no rooms
    // (scope whole_listing) but flags the thread so the host picks the room.
    const scope = roomIntent === "rooms" ? "rooms" : "whole_listing";
    const messageOut = (
      roomIntent === "unsure"
        ? `Not sure which room — please recommend the best fit for my party of ${partySize}.\n\n${message.trim()}`.trim()
        : message.trim()
    ).slice(0, 2000); // stay within the enquiry schema's message cap
    setPending(true);
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          property_id: listingId,
          scope,
          room_ids: scope === "rooms" ? selectedRooms : [],
          check_in: checkIn,
          check_out: checkOut,
          guests_breakdown: { adults, children, infants, pets },
          message: messageOut,
          guest_name: name.trim(),
          guest_email: email.trim(),
          guest_phone: phone.trim() || "",
          hp,
        }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          isLead?: boolean;
          email?: string;
          conversationId?: string;
          redirectTo?: string;
        };
      };
      if (result.ok) {
        // Signed-in guests go straight to their thread — keep the spinner up
        // through the navigation so the form never flashes back (the old bug).
        if (isAuthed && result.data?.redirectTo) {
          setNavigating(true);
          window.location.assign(result.data.redirectTo);
          return;
        }
        // Everyone else stays in the modal: we show the thank-you and, for a new
        // lead, the create-your-account prompt — in place, no redirect, no flash.
        setSent({
          isLead: result.data?.isLead ?? false,
          email: result.data?.email ?? email.trim(),
          conversationId: result.data?.conversationId,
          redirectTo: result.data?.redirectTo,
        });
        setPending(false);
        setDone(true);
        return;
      }
      toast.error(result.error || "Could not send your request.");
      setPending(false);
    } catch {
      toast.error(
        "Couldn't reach the server. Check your connection and try again.",
      );
      setPending(false);
    }
  }

  // Send the guest to the claim screen (set a password) — or, for an existing
  // account, the login that returns them to their thread.
  function goToAccount() {
    if (!sent?.redirectTo) return;
    setNavigating(true);
    window.location.assign(sent.redirectTo);
  }

  // Live request shape, shown as the guest builds it (and drives the CTA hint).
  const nights =
    checkIn && checkOut && checkOut > checkIn
      ? Math.round(
          (new Date(`${checkOut}T00:00:00`).getTime() -
            new Date(`${checkIn}T00:00:00`).getTime()) /
            86_400_000,
        )
      : 0;
  const guestCount = adults + children;
  const summaryBits = [
    nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : null,
    `${guestCount} guest${guestCount === 1 ? "" : "s"}`,
    selectedRooms.length
      ? `${selectedRooms.length} room${selectedRooms.length === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  // ══ Fullscreen (mobile) quote wizard model ════════════════════════
  // Mirrors the checkout flow: a dedicated full-viewport shell, a persistent
  // host header, one decision per screen, then send. Uses the SAME bare
  // CheckoutDateEditor as the booking wizard, so booked dates are greyed
  // light-yellow + unselectable — a quote can't be asked for taken dates.
  type QKey = "dates" | "guests" | "room" | "message" | "contact";
  const qSteps: QKey[] = [
    "dates",
    "guests",
    ...(roomsPickable ? (["room"] as QKey[]) : []),
    "message",
    ...(!isAuthed ? (["contact"] as QKey[]) : []),
  ];
  const qClamped = Math.min(qIndex, qSteps.length - 1);
  const qKey = qSteps[qClamped];
  const qLast = qClamped === qSteps.length - 1;
  const qMeta: Record<QKey, { q: string; sub: string }> = {
    dates: {
      q: "When would you like to stay?",
      sub: "Pick your dates — booked dates are greyed out. Fine-tune with the host after they quote.",
    },
    guests: {
      q: "Who’s coming along?",
      sub: "Helps the host price your quote right.",
    },
    room: {
      q: "Which room(s)?",
      sub: `Pick one or more rooms, the whole listing, or “Not sure”. We’ve pre-picked enough to sleep your ${partySize} guest${partySize === 1 ? "" : "s"}.`,
    },
    message: {
      q: "Tell the host what you need",
      sub: "The more they know, the better the quote — flexibility, occasion, special requests.",
    },
    contact: {
      q: "Where do we send the quote?",
      sub: "The host replies here with your tailored quote. No payment now.",
    },
  };
  function qBlocked(k: QKey): boolean {
    switch (k) {
      case "dates":
        return !(checkIn && checkOut && checkOut > checkIn);
      case "room":
        return roomIntent === "rooms" && selectedRooms.length === 0;
      case "message":
        return message.trim().length === 0;
      case "contact":
        return name.trim().length < 2 || !/\S+@\S+\.\S+/.test(email.trim());
      default:
        return false;
    }
  }
  function qReason(k: QKey): string | null {
    if (!qBlocked(k)) return null;
    switch (k) {
      case "dates":
        return checkIn && !checkOut
          ? "Now choose your check-out date."
          : "Choose your check-in and check-out dates.";
      case "room":
        return "Pick a room, the whole listing, or “Not sure”.";
      case "message":
        return "Add a short message for the host.";
      case "contact":
        return "Add your name and a valid email.";
      default:
        return null;
    }
  }
  function qNext() {
    if (qLast) {
      void submitQuote();
      return;
    }
    setQIndex(qClamped + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function qBack() {
    if (qClamped === 0) {
      setOpen(false);
      return;
    }
    setQIndex(qClamped - 1);
  }

  // Escape steps back (and closes from the first screen) — but never while a
  // send / navigation is in flight, matching the header back button.
  useEffect(() => {
    if (!fullscreen || !open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || pending || navigating) return;
      if (qClamped === 0) setOpen(false);
      else setQIndex(qClamped - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, open, pending, navigating, qClamped]);

  const qCard = "rounded-card border border-brand-line bg-white";
  const qStepBtn =
    "flex h-10 w-10 items-center justify-center rounded-pill border border-brand-line text-brand-ink transition hover:bg-brand-accent disabled:opacity-30";
  const intentCardCls = (on: boolean) =>
    `flex w-full items-center gap-3 rounded-card border p-3.5 text-left transition ${
      on
        ? "ck-selected border-brand-primary bg-brand-light/50"
        : "border-brand-line bg-white"
    }`;
  // Round selector for the single-choice intent cards (whole / not-sure).
  const qRadio = (on: boolean) => (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border-2 ${
        on
          ? "border-brand-primary bg-brand-primary text-white"
          : "border-brand-line"
      }`}
    >
      {on ? <Check className="h-3.5 w-3.5" /> : null}
    </span>
  );

  const trigger = (
    <button
      type="button"
      onClick={() => {
        reset();
        setOpen(true);
      }}
      className={
        triggerClassName ??
        "inline-flex items-center gap-1.5 rounded bg-brand-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
      }
    >
      <MessageSquarePlus className="h-4 w-4" /> {triggerLabel}
    </button>
  );

  // ── MOBILE: dedicated full-viewport quote wizard ──────────────────
  if (fullscreen) {
    return (
      <>
        {trigger}
        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Request a quote · ${listingName}`}
            className="fixed inset-0 z-[60] flex flex-col bg-white lg:hidden"
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
@keyframes ck-step-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.ck-step{animation:ck-step-in .32s cubic-bezier(.2,.7,.2,1) both;}
.ck-selected{box-shadow:0 0 0 2px #10B981 inset, 0 8px 28px -16px rgba(6,78,59,0.18);}
@media (prefers-reduced-motion: reduce){.ck-step{animation:none!important;}}
`,
              }}
            />

            {/* Persistent host header */}
            <header className="flex flex-none items-center gap-2.5 border-b border-brand-line px-3 pb-2.5 pt-[max(10px,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={qBack}
                disabled={pending || navigating}
                aria-label={qClamped === 0 ? "Close" : "Back"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-brand-ink transition hover:bg-brand-light disabled:opacity-40"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              {hostAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hostAvatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-pill object-cover ring-1 ring-brand-line"
                />
              ) : coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImageUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-[13px] font-bold text-brand-secondary">
                  {(hostName ?? listingName).trim().charAt(0).toUpperCase() ||
                    "W"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-bold leading-tight text-brand-ink">
                  {listingName}
                </div>
                <div className="truncate text-[11px] text-brand-mute">
                  {hostName && hostName !== listingName
                    ? `Hosted by ${hostName}`
                    : listingTypeLabel}
                  {listingCity ? ` · ${listingCity}` : ""}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-brand-secondary">
                Quote
              </span>
            </header>

            {/* Content */}
            <div
              key={pending || navigating ? "busy" : done ? "done" : qKey}
              className="ck-step min-h-0 flex-1 overflow-y-auto px-4 py-3.5"
            >
              {pending || navigating ? (
                <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-brand-ink">
                    {navigating
                      ? "Taking you to your account…"
                      : "Sending your request…"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-brand-mute">
                    {navigating
                      ? "One moment — getting your secure account ready."
                      : `Notifying ${listingName}'s host and setting up your thread.`}
                  </p>
                </div>
              ) : done ? (
                <ThankYou
                  firstName={name.split(" ")[0] || "You"}
                  email={sent?.email ?? email}
                  listingName={listingName}
                  isLead={sent?.isLead ?? false}
                  canCreateAccount={!!sent?.redirectTo}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  party={{ adults, children, infants, pets }}
                  roomNames={rooms
                    .filter((r) => selectedRooms.includes(r.id))
                    .map((r) => r.name)}
                  onCreateAccount={goToAccount}
                  onClose={() => setOpen(false)}
                />
              ) : (
                <>
                  {/* Honeypot — off-screen; bots fill it. */}
                  <input
                    type="text"
                    name="vilo_hp"
                    tabIndex={-1}
                    autoComplete="off"
                    value={hp}
                    onChange={(e) => setHp(e.target.value)}
                    className="absolute left-[-9999px] h-0 w-0 opacity-0"
                    aria-hidden="true"
                  />

                  <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
                    Request a quote
                  </div>
                  <h2 className="mt-0.5 font-display text-lg font-extrabold leading-tight tracking-tight text-brand-ink">
                    {qMeta[qKey].q}
                  </h2>
                  <p className="mb-3.5 mt-1 text-[12.5px] leading-snug text-brand-mute">
                    {qMeta[qKey].sub}
                  </p>

                  {qKey === "dates" ? (
                    <CheckoutDateEditor
                      bare
                      from={checkIn}
                      to={checkOut}
                      minNights={1}
                      onChange={(f, t) => {
                        setCheckIn(f);
                        setCheckOut(t);
                      }}
                      unavailable={unavailableDates}
                    />
                  ) : null}

                  {qKey === "guests" ? (
                    <div className={qCard}>
                      {(
                        [
                          ["Adults", "Ages 13+", adults, setAdults, 1],
                          ["Children", "Ages 2–12", children, setChildren, 0],
                          ["Infants", "Under 2", infants, setInfants, 0],
                          [
                            "Pets",
                            "Assistance animals always welcome",
                            pets,
                            setPets,
                            0,
                          ],
                        ] as const
                      ).map(([label, sub, val, set, min], i) => (
                        <div
                          key={label}
                          className={`flex items-center justify-between gap-3 px-4 py-3 ${
                            i > 0 ? "border-t border-brand-line" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-brand-ink">
                              {label}
                            </div>
                            <div className="text-[11.5px] text-brand-mute">
                              {sub}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => set(Math.max(min, val - 1))}
                              disabled={val <= min}
                              aria-label={`Fewer ${label}`}
                              className={qStepBtn}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold tabular-nums text-brand-ink">
                              {val}
                            </span>
                            <button
                              type="button"
                              onClick={() => set(Math.min(99, val + 1))}
                              aria-label={`More ${label}`}
                              className={qStepBtn}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {qKey === "room" ? (
                    <div className="space-y-2.5">
                      {/* Whole listing */}
                      <button
                        type="button"
                        onClick={() => {
                          setRoomsTouched(true);
                          setRoomIntent("whole");
                        }}
                        className={intentCardCls(roomIntent === "whole")}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-secondary">
                          <Home className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display font-semibold text-brand-ink">
                            The whole listing
                          </span>
                          <span className="block text-[11.5px] text-brand-mute">
                            Quote the entire place
                          </span>
                        </span>
                        {qRadio(roomIntent === "whole")}
                      </button>

                      {/* Not sure — host recommends */}
                      <button
                        type="button"
                        onClick={() => {
                          setRoomsTouched(true);
                          setRoomIntent("unsure");
                        }}
                        className={intentCardCls(roomIntent === "unsure")}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-secondary">
                          <HelpCircle className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display font-semibold text-brand-ink">
                            Not sure yet
                          </span>
                          <span className="block text-[11.5px] text-brand-mute">
                            The host recommends the best room
                          </span>
                        </span>
                        {qRadio(roomIntent === "unsure")}
                      </button>

                      <div className="flex items-center gap-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                        <span className="h-px flex-1 bg-brand-line" />
                        Or pick room(s)
                        <span className="h-px flex-1 bg-brand-line" />
                      </div>

                      {rooms.map((r) => {
                        const on =
                          roomIntent === "rooms" &&
                          selectedRooms.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleRoomCard(r.id)}
                            className={`flex w-full items-center gap-3 rounded-card border p-3.5 text-left transition ${
                              on
                                ? "ck-selected border-brand-primary bg-brand-light/50"
                                : "border-brand-line bg-white"
                            }`}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                              <BedDouble className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-display font-semibold text-brand-ink">
                                {r.name}
                              </span>
                              <span className="block text-[11.5px] text-brand-mute">
                                Sleeps {r.maxGuests}
                              </span>
                            </span>
                            {/* Square = multi-select */}
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                                on
                                  ? "border-brand-primary bg-brand-primary text-white"
                                  : "border-brand-line"
                              }`}
                            >
                              {on ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                          </button>
                        );
                      })}

                      {roomIntent === "rooms" && selectedRooms.length > 0 ? (
                        <div
                          className={`flex items-start gap-2 rounded-card border p-3 text-[12px] leading-snug ${
                            roomShort
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-brand-line bg-brand-light/50 text-brand-secondary"
                          }`}
                        >
                          <Users className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            {roomShort
                              ? `These rooms sleep ${selectedCapacity} — add a room for your ${partySize} guest${partySize === 1 ? "" : "s"}.`
                              : `Sleeps ${selectedCapacity} · fits your ${partySize} guest${partySize === 1 ? "" : "s"}.`}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {qKey === "message" ? (
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) =>
                        setMessage(e.target.value.slice(0, 2000))
                      }
                      placeholder="What are you looking for? Any special requests, occasion, flexibility on dates…"
                      className="w-full resize-none rounded-card border border-brand-line bg-white px-3.5 py-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                    />
                  ) : null}

                  {qKey === "contact" ? (
                    <div className={`${qCard} space-y-3 p-4`}>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                          Full name
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Amara Okafor"
                          autoComplete="name"
                          className="w-full rounded border border-brand-line bg-white px-3.5 py-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                          Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="amara@example.com"
                          autoComplete="email"
                          className="w-full rounded border border-brand-line bg-white px-3.5 py-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-brand-ink">
                          Phone{" "}
                          <span className="font-normal text-brand-mute">
                            (optional)
                          </span>
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+27 82 000 0000"
                          autoComplete="tel"
                          className="w-full rounded border border-brand-line bg-white px-3.5 py-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Wielo mark — bottom of each step's content. Links HOME, never
                      to sign-up: a visitor mid-quote must not be yanked out of the
                      flow onto a signup form (same rule as checkout). */}
                  <a
                    href="/"
                    className="mt-5 flex items-center justify-center gap-1.5 pb-1 text-[11px] font-medium text-brand-mute transition-colors hover:text-brand-ink"
                  >
                    <VLogo size={14} gradientId="quote-foot" /> Powered by Wielo
                  </a>
                </>
              )}
            </div>

            {/* Footer CTA — hidden on the busy + thank-you screens */}
            {!done && !pending && !navigating ? (
              <footer className="flex-none border-t border-brand-line bg-white px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
                {qBlocked(qKey) && qReason(qKey) ? (
                  <div className="mb-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] leading-snug text-amber-800">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    {qReason(qKey)}
                  </div>
                ) : (
                  <div className="mb-2 text-center text-[11px] text-brand-mute">
                    No payment now · the host replies with a tailored quote
                  </div>
                )}
                <button
                  type="button"
                  onClick={qNext}
                  disabled={qBlocked(qKey)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-brand-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {qLast ? (
                    <>
                      <Sparkles className="h-4 w-4" /> Send request
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </footer>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {trigger}

      <FormModal
        open={open}
        // Lock the modal while the request is in flight or a navigation is under
        // way so the guest can't dismiss it mid-send (and so it can't flash).
        onOpenChange={(v) => {
          if (!pending && !navigating) setOpen(v);
        }}
        size="lg"
        title={
          pending || navigating
            ? "Sending your request…"
            : done
              ? "Request sent"
              : `Request a quote · ${listingName}`
        }
        description={
          pending || navigating || done
            ? undefined
            : "Tell the host your dates and party — they'll reply with a tailored quote. No payment now."
        }
      >
        {pending || navigating ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h3 className="mt-3 font-display text-lg font-bold text-brand-ink">
              {navigating
                ? "Taking you to your account…"
                : "Sending your request…"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-brand-mute">
              {navigating
                ? "One moment — getting your secure account ready."
                : `Just a second — we're notifying ${listingName}'s host and setting up your thread. Please don't close this window.`}
            </p>
          </div>
        ) : done ? (
          <ThankYou
            firstName={name.split(" ")[0] || "You"}
            email={sent?.email ?? email}
            listingName={listingName}
            isLead={sent?.isLead ?? false}
            canCreateAccount={!!sent?.redirectTo}
            checkIn={checkIn}
            checkOut={checkOut}
            party={{ adults, children, infants, pets }}
            roomNames={rooms
              .filter((r) => selectedRooms.includes(r.id))
              .map((r) => r.name)}
            onCreateAccount={goToAccount}
            onClose={() => setOpen(false)}
          />
        ) : (
          <form
            id="request-quote-form"
            onSubmit={onSubmit}
            className="space-y-5"
          >
            {/* Honeypot — visually hidden, off-screen; bots fill it. Named
                neutrally + autocomplete off so browsers don't autofill it. */}
            <input
              type="text"
              name="vilo_hp"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              aria-hidden="true"
            />

            <section className="space-y-2.5">
              <SectionHead
                icon={CalendarDays}
                title="Your dates"
                hint="When would you like to stay?"
              />
              <DateRangePicker
                from={checkIn}
                to={checkOut}
                min={today}
                onChange={(from, to) => {
                  setCheckIn(from);
                  setCheckOut(to);
                }}
              />
              {nights > 0 ? (
                <p className="text-[12.5px] text-brand-mute">
                  <span className="font-semibold text-brand-ink">
                    {nights} night{nights === 1 ? "" : "s"}
                  </span>{" "}
                  · you can fine-tune anything with the host after they quote.
                </p>
              ) : null}
            </section>

            <section className="space-y-2.5">
              <SectionHead
                icon={Users}
                title="Who's coming"
                hint="Helps the host price it right."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stepper
                  label="Adults"
                  value={adults}
                  setValue={setAdults}
                  min={1}
                />
                <Stepper
                  label="Children"
                  value={children}
                  setValue={setChildren}
                />
                <Stepper
                  label="Infants"
                  value={infants}
                  setValue={setInfants}
                />
                <Stepper label="Pets" value={pets} setValue={setPets} />
              </div>
            </section>

            {roomsPickable ? (
              <section className="space-y-2.5">
                <SectionHead
                  icon={BedDouble}
                  title="Room"
                  hint="Which room(s) would you like quoted?"
                />
                <Select
                  value={
                    roomIntent === "whole"
                      ? WHOLE_PLACE
                      : roomIntent === "unsure"
                        ? UNSURE
                        : (selectedRooms[0] ?? "")
                  }
                  onValueChange={(v) => {
                    setRoomsTouched(true);
                    if (v === WHOLE_PLACE) {
                      setRoomIntent("whole");
                      setSelectedRooms([]);
                    } else if (v === UNSURE) {
                      setRoomIntent("unsure");
                      setSelectedRooms([]);
                    } else {
                      setRoomIntent("rooms");
                      setSelectedRooms([v]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WHOLE_PLACE}>
                      The whole listing
                    </SelectItem>
                    <SelectItem value={UNSURE}>
                      Not sure — the host recommends
                    </SelectItem>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · sleeps {r.maxGuests}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {roomShort ? (
                  <p className="text-[12px] text-amber-700">
                    That room sleeps {selectedCapacity} — your party is{" "}
                    {partySize}. The host can suggest more rooms.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-2.5">
              <SectionHead
                icon={MessageSquare}
                title="Your message"
                hint="The more the host knows, the better the quote."
              />
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                placeholder="What are you looking for? Any special requests, occasion, flexibility on dates…"
                className={inputCls}
                required
              />
            </section>

            {isAuthed ? (
              <p className="rounded-[10px] border border-brand-line bg-brand-light/60 px-3 py-2 text-xs text-brand-mute">
                Sending as{" "}
                <span className="font-medium text-brand-ink">
                  {name || email}
                </span>
                {name && email ? ` · ${email}` : ""}. Update these in your
                profile settings.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>
                <Field label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            <div className="flex items-start gap-2 rounded-[10px] border border-brand-line bg-brand-light/50 px-3 py-2.5 text-[12px] text-brand-mute">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              <span>
                No payment now — {listingName}&rsquo;s host replies with a
                tailored quote you can accept later.
                {summaryBits.length ? (
                  <>
                    {" "}
                    You&rsquo;re requesting{" "}
                    <span className="font-semibold text-brand-ink">
                      {summaryBits.join(" · ")}
                    </span>
                    .
                  </>
                ) : null}
              </span>
            </div>

            <FormModalFooter>
              <FormModalCancel>Cancel</FormModalCancel>
              <button
                type="submit"
                form="request-quote-form"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {pending ? "Sending…" : "Send request"}
              </button>
            </FormModalFooter>
          </form>
        )}
      </FormModal>
    </>
  );
}

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";

function fmtDay(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

// In-place success state: a two-column thank-you — the confirmation + a prompt
// to create a free account on the left, a recap of what they just requested on
// the right. New leads get the "set a password" CTA; everyone else just closes.
function ThankYou({
  firstName,
  email,
  listingName,
  isLead,
  canCreateAccount,
  checkIn,
  checkOut,
  party,
  roomNames,
  onCreateAccount,
  onClose,
}: {
  firstName: string;
  email: string;
  listingName: string;
  isLead: boolean;
  canCreateAccount: boolean;
  checkIn: string;
  checkOut: string;
  party: { adults: number; children: number; infants: number; pets: number };
  roomNames: string[];
  onCreateAccount: () => void;
  onClose: () => void;
}) {
  const nights =
    checkIn && checkOut
      ? Math.max(
          0,
          Math.round(
            (new Date(`${checkOut}T00:00:00`).getTime() -
              new Date(`${checkIn}T00:00:00`).getTime()) /
              86_400_000,
          ),
        )
      : 0;
  const partyBits = [
    party.adults
      ? `${party.adults} adult${party.adults === 1 ? "" : "s"}`
      : null,
    party.children
      ? `${party.children} child${party.children === 1 ? "" : "ren"}`
      : null,
    party.infants
      ? `${party.infants} infant${party.infants === 1 ? "" : "s"}`
      : null,
    party.pets ? `${party.pets} pet${party.pets === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-5 py-1 sm:grid-cols-[1fr_minmax(0,240px)]">
      {/* Confirmation + create account */}
      <div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-status-confirmed/10 text-status-confirmed">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-display text-lg font-bold text-brand-ink">
          Your request is on its way
        </h3>
        <p className="mt-1 text-sm text-brand-mute">
          {firstName} — {listingName}&rsquo;s host has your enquiry and will
          reply with a tailored quote to{" "}
          <span className="font-medium text-brand-ink">{email}</span>.
        </p>

        {canCreateAccount && isLead ? (
          <div className="mt-4 rounded-card border border-brand-line bg-brand-light/50 p-4">
            <p className="text-[13px] font-semibold text-brand-ink">
              Create your free account
            </p>
            <ul className="mt-2.5 space-y-2 text-[12.5px] text-brand-mute">
              <li className="flex gap-2">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <span>
                  Chat with the host and track this quote in one place.
                </span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <span>Keep every trip, message and document safe.</span>
              </li>
              <li className="flex gap-2">
                <BadgePercent className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <span>Book faster next time and unlock member perks.</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={onCreateAccount}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              <Lock className="h-4 w-4" /> Create my password
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-[10px] px-4 py-2 text-sm font-medium text-brand-mute transition hover:text-brand-ink"
            >
              Maybe later
            </button>
          </div>
        ) : canCreateAccount ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={onCreateAccount}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
            >
              Log in to view your request
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[10px] px-4 py-2 text-sm font-medium text-brand-mute transition hover:text-brand-ink"
            >
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 inline-flex w-full items-center justify-center rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
          >
            Done
          </button>
        )}
      </div>

      {/* Recap of what they requested */}
      <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Your request
        </div>
        <div className="mt-1.5 font-display text-[14px] font-bold leading-tight text-brand-ink">
          {listingName}
        </div>
        <dl className="mt-3 space-y-2.5 border-t border-brand-line pt-3 text-[12.5px]">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
            <div>
              <div className="font-semibold text-brand-ink">
                {fmtDay(checkIn)} → {fmtDay(checkOut)}
              </div>
              {nights > 0 ? (
                <div className="text-brand-mute">
                  {nights} night{nights === 1 ? "" : "s"}
                </div>
              ) : null}
            </div>
          </div>
          {partyBits.length ? (
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
              <div className="font-semibold text-brand-ink">
                {partyBits.join(" · ")}
              </div>
            </div>
          ) : null}
          {roomNames.length ? (
            <div className="flex items-start gap-2">
              <MessageSquarePlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
              <div className="font-semibold text-brand-ink">
                {roomNames.join(", ")}
              </div>
            </div>
          ) : null}
        </dl>
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
    <label className="block">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Labelled group header (icon tile + title + hint) — matches the create-data
 *  editors so the request modal reads as a short, guided flow. */
function SectionHead({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-accent/50 text-brand-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-sm font-semibold text-brand-ink">
          {title}
        </div>
        {hint ? <p className="text-xs text-brand-mute">{hint}</p> : null}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  setValue,
  min = 0,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="rounded-[10px] border border-brand-line px-3 py-2">
      <div className="text-[11px] text-brand-mute">{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setValue(Math.max(min, value - 1))}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-line text-brand-ink hover:bg-brand-light disabled:opacity-40"
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="num text-sm font-semibold text-brand-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={() => setValue(Math.min(99, value + 1))}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-line text-brand-ink hover:bg-brand-light"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
