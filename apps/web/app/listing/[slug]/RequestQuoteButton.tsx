"use client";

import { CheckCircle2, Loader2, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

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

  const roomsPickable = bookingMode !== "whole_listing" && rooms.length > 0;

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
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

  function toggleRoom(id: string) {
    setSelectedRooms((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  function reset() {
    setDone(false);
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
          listing_id: listingId,
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
        data?: { redirectTo?: string };
      };
      if (result.ok) {
        // Hand off to the claim flow (new lead) or login (existing account),
        // which lands the guest on their enquiry thread. Keep the button
        // spinning through the navigation.
        const dest = result.data?.redirectTo;
        if (dest) {
          window.location.assign(dest);
          return;
        }
        setDone(true);
      } else {
        toast.error(result.error || "Could not send your request.");
      }
    } catch {
      toast.error(
        "Couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

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
        // Lock the modal while the request is in flight so the guest can't
        // dismiss it mid-send (the spinner runs through the redirect too).
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
        size="lg"
        title={
          pending
            ? "Sending your request…"
            : done
              ? "Request sent"
              : `Request a quote · ${listingName}`
        }
        description={
          pending || done
            ? undefined
            : "Tell the host your dates and party — they'll reply with a tailored quote. No payment now."
        }
      >
        {pending ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h3 className="mt-3 font-display text-lg font-bold text-brand-ink">
              Sending your request…
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-brand-mute">
              Just a second — we&rsquo;re notifying {listingName}&rsquo;s host
              and setting up your thread. Please don&rsquo;t close this window.
            </p>
          </div>
        ) : done ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-confirmed/10 text-status-confirmed">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-3 font-display text-lg font-bold text-brand-ink">
              Your request is on its way
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-brand-mute">
              {name.split(" ")[0] || "You"} — the host has your enquiry and will
              send a quote to{" "}
              <span className="font-medium text-brand-ink">{email}</span>. Watch
              your email for the link to view and accept it.
            </p>
            <FormModalFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
              >
                Done
              </button>
            </FormModalFooter>
          </div>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Check-in">
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Check-out">
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
            </div>

            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
                Party
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            </div>

            {roomsPickable ? (
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-brand-mute">
                  Rooms {bookingMode === "flexible" ? "(optional)" : ""}
                </div>
                <div className="mt-2 space-y-1.5">
                  {rooms.map((r) => (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-brand-line px-3 py-2 text-sm text-brand-ink hover:bg-brand-light/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRooms.includes(r.id)}
                        onChange={() => toggleRoom(r.id)}
                        className="h-4 w-4 accent-brand-primary"
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <Field label="Your message">
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                placeholder="What are you looking for? Any special requests, occasion, flexibility on dates…"
                className={inputCls}
                required
              />
            </Field>

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
                  <MessageSquarePlus className="h-4 w-4" />
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
