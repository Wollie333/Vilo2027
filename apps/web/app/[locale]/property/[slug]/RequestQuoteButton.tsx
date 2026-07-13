"use client";

import {
  BadgePercent,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

// Radix Select forbids an empty-string value, so use a sentinel for the
// "no specific room / whole place" choice (flexible listings only).
const WHOLE_PLACE = "__whole__";

type RoomOption = { id: string; name: string };

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
}) {
  const [open, setOpen] = useState(false);
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

  function reset() {
    setDone(false);
    setNavigating(false);
    setSent(null);
    setCheckIn(initialCheckIn);
    setCheckOut(initialCheckOut);
    setAdults(2);
    setChildren(0);
    setInfants(0);
    setPets(0);
    setSelectedRooms([]);
    setMessage("");
    setName(prefillName);
    setEmail(prefillEmail);
    setPhone(prefillPhone);
    setHp("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      toast.error("Pick valid check-in and check-out dates.");
      return;
    }
    if (bookingMode === "rooms_only" && selectedRooms.length === 0) {
      toast.error("Pick at least one room.");
      return;
    }
    const scope = selectedRooms.length > 0 ? "rooms" : "whole_listing";
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
          message: message.trim(),
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

  return (
    <>
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
                  title={`Room${bookingMode === "flexible" ? " (optional)" : ""}`}
                  hint="Which room would you like quoted?"
                />
                <Select
                  value={
                    selectedRooms[0] ??
                    (bookingMode === "flexible" ? WHOLE_PLACE : "")
                  }
                  onValueChange={(v) =>
                    setSelectedRooms(v === WHOLE_PLACE ? [] : [v])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingMode === "flexible" ? (
                      <SelectItem value={WHOLE_PLACE}>
                        The whole place
                      </SelectItem>
                    ) : null}
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
