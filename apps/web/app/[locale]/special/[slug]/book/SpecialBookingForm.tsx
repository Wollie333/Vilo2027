"use client";

import { Loader2, Lock, Tag } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  computeAddonSubtotal,
  defaultAddonQuantity,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import { formatMoney } from "@/lib/format";

import { createCheckoutGuestAccountAction } from "../../../property/[slug]/book/actions";
import { createSpecialBookingAction } from "./actions";

export type SpecialAddonOption = {
  id: string;
  name: string;
  description: string | null;
  pricingModel: PricingModel;
  unitPrice: number;
  minQuantity: number;
  currency: string;
};

type Props = {
  specialId: string;
  slug: string;
  bookedVia: "platform" | "website";
  title: string;
  description: string | null;
  badge: string | null;
  heroUrl: string | null;
  categoryLabels: string[];
  propertyName: string;
  propertyCity: string | null;
  propertyProvince: string | null;
  roomName: string | null;
  hostName: string | null;
  currency: string;
  dateMode: "fixed" | "flexible";
  fixedCheckIn: string | null;
  fixedCheckOut: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  minNights: number | null;
  maxNights: number | null;
  priceMode: "flat" | "per_night";
  flatTotal: number | null;
  perNightPrice: number | null;
  maxGuests: number;
  wasPrice: number | null;
  savingsAmount: number | null;
  savingsPct: number | null;
  remaining: number;
  requiredAddons: SpecialAddonOption[];
  optionalAddons: SpecialAddonOption[];
  cancellationNote: string | null;
  hasEftBanking: boolean;
  hasPaystack: boolean;
  isAuthenticated: boolean;
  guestEmail: string;
  guestName: string;
  guestPhone: string;
};

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms =
    new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function SpecialBookingForm(props: Props) {
  const soldOut = props.remaining <= 0;

  // ── dates ─────────────────────────────────────────────────────────
  const [checkIn, setCheckIn] = useState(
    props.dateMode === "fixed"
      ? (props.fixedCheckIn ?? "")
      : (props.windowStart ?? ""),
  );
  const [checkOut, setCheckOut] = useState(
    props.dateMode === "fixed" ? (props.fixedCheckOut ?? "") : "",
  );

  const [guests, setGuests] = useState(Math.min(2, props.maxGuests));

  // ── optional add-on selection ─────────────────────────────────────
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const toggleAddon = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  // ── contact + account ─────────────────────────────────────────────
  const [name, setName] = useState(props.guestName);
  const [email, setEmail] = useState(props.guestEmail);
  const [phone, setPhone] = useState(props.guestPhone);
  const [password, setPassword] = useState("");
  const [requests, setRequests] = useState("");

  const methods: ("paystack" | "eft")[] = [
    ...(props.hasPaystack ? (["paystack"] as const) : []),
    ...(props.hasEftBanking ? (["eft"] as const) : []),
  ];
  const [method, setMethod] = useState<"paystack" | "eft">(
    methods[0] ?? "paystack",
  );
  const [ack, setAck] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nights = nightsBetween(checkIn, checkOut);

  // ── advisory estimate (the server re-prices authoritatively) ──────
  const estimate = useMemo(() => {
    const effNights =
      nights > 0
        ? nights
        : props.dateMode === "flexible"
          ? (props.minNights ?? 1)
          : 1;
    const accommodation =
      props.priceMode === "flat"
        ? (props.flatTotal ?? 0)
        : (props.perNightPrice ?? 0) * effNights;

    const addonTotal = (opt: SpecialAddonOption) =>
      computeAddonSubtotal(
        opt.pricingModel,
        opt.unitPrice,
        defaultAddonQuantity(opt.pricingModel, opt.minQuantity, effNights),
        guests,
      );

    let addons = 0;
    for (const a of props.requiredAddons) addons += addonTotal(a);
    for (const a of props.optionalAddons) {
      if (selected[a.id]) addons += addonTotal(a);
    }
    return { accommodation, addons, total: accommodation + addons };
  }, [
    nights,
    guests,
    selected,
    props.dateMode,
    props.minNights,
    props.priceMode,
    props.flatTotal,
    props.perNightPrice,
    props.requiredAddons,
    props.optionalAddons,
  ]);

  const datesReady =
    props.dateMode === "fixed" ||
    (checkIn !== "" && checkOut !== "" && nights > 0);
  const canPay = !soldOut && methods.length > 0 && datesReady && ack;

  function validateLocal(): string | null {
    if (soldOut) return "This special is sold out.";
    if (!datesReady) return "Choose your check-in and check-out dates.";
    if (props.dateMode === "flexible") {
      if (props.windowStart && checkIn < props.windowStart)
        return "Check-in is before the offer window.";
      if (props.windowEnd && checkOut > props.windowEnd)
        return "Check-out is after the offer window.";
      if (props.minNights && nights < props.minNights)
        return `This deal needs at least ${props.minNights} nights.`;
      if (props.maxNights && nights > props.maxNights)
        return `This deal is for at most ${props.maxNights} nights.`;
    }
    if (!props.isAuthenticated) {
      if (name.trim().length < 2) return "Tell us your name.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return "Enter a valid email.";
      if (password.length < 8)
        return "Choose a password of at least 8 characters.";
    }
    if (!ack) return "Please accept the policies to book.";
    return null;
  }

  function submit() {
    setError(null);
    const local = validateLocal();
    if (local) {
      setError(local);
      return;
    }
    startTransition(async () => {
      // Create a guest account inline if needed (mirrors the property checkout).
      if (!props.isAuthenticated) {
        const acct = await createCheckoutGuestAccountAction({
          full_name: name.trim(),
          email: email.trim(),
          password,
        });
        if (!acct.ok) {
          setError(acct.error);
          return;
        }
      }
      const res = await createSpecialBookingAction({
        special_id: props.specialId,
        booked_via: props.bookedVia,
        check_in: props.dateMode === "flexible" ? checkIn : undefined,
        check_out: props.dateMode === "flexible" ? checkOut : undefined,
        guests,
        payment_method: method,
        guest_name: name.trim() || undefined,
        guest_email: email.trim() || undefined,
        guest_phone: phone.trim() || undefined,
        special_requests: requests.trim() || undefined,
        selected_addons: props.optionalAddons
          .filter((a) => selected[a.id])
          .map((a) => a.id),
        policy_acknowledged: ack,
      });
      // A successful action redirects server-side; only an error returns here.
      if (res && !res.ok) setError(res.error);
    });
  }

  const place = [props.propertyCity, props.propertyProvince]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* ── left: the deal + form ── */}
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-brand-line">
          {props.heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.heroUrl}
              alt={props.title}
              className="h-48 w-full object-cover"
            />
          ) : null}
          <div className="space-y-2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {props.badge ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
                  <Tag className="h-3 w-3" /> {props.badge}
                </span>
              ) : null}
              {props.categoryLabels.map((c) => (
                <span
                  key={c}
                  className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute"
                >
                  {c}
                </span>
              ))}
            </div>
            <h1 className="font-display text-2xl font-extrabold text-brand-ink">
              {props.title}
            </h1>
            <p className="text-sm text-brand-mute">
              {props.propertyName}
              {props.roomName ? ` · ${props.roomName}` : ""}
              {place ? ` · ${place}` : ""}
              {props.hostName ? ` · hosted by ${props.hostName}` : ""}
            </p>
            {props.description ? (
              <p className="whitespace-pre-line text-sm text-brand-ink/80">
                {props.description}
              </p>
            ) : null}
            {props.savingsAmount && props.savingsPct ? (
              <p className="text-sm font-semibold text-emerald-600">
                Save {formatMoney(props.savingsAmount, props.currency)} (
                {props.savingsPct}% off)
                {props.wasPrice ? (
                  <span className="ml-1 font-normal text-brand-mute line-through">
                    {formatMoney(props.wasPrice, props.currency)}
                  </span>
                ) : null}
              </p>
            ) : null}
            {!soldOut && props.remaining <= 5 ? (
              <p className="text-xs font-medium text-amber-600">
                Only {props.remaining} left
              </p>
            ) : null}
          </div>
        </div>

        {soldOut ? (
          <div className="rounded-2xl border border-brand-line bg-brand-light p-5 text-sm text-brand-mute">
            This special is sold out.
          </div>
        ) : (
          <>
            {/* dates */}
            <section className="space-y-3 rounded-2xl border border-brand-line p-5">
              <h2 className="text-sm font-semibold text-brand-ink">
                Your dates
              </h2>
              {props.dateMode === "fixed" ? (
                <p className="text-sm text-brand-ink">
                  {props.fixedCheckIn} → {props.fixedCheckOut}{" "}
                  <span className="text-brand-mute">
                    (
                    {nightsBetween(
                      props.fixedCheckIn ?? "",
                      props.fixedCheckOut ?? "",
                    )}{" "}
                    nights — fixed)
                  </span>
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-brand-mute">
                    Check-in
                    <input
                      type="date"
                      value={checkIn}
                      min={props.windowStart ?? undefined}
                      max={props.windowEnd ?? undefined}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-brand-line px-3 py-2 text-sm text-brand-ink"
                    />
                  </label>
                  <label className="block text-xs text-brand-mute">
                    Check-out
                    <input
                      type="date"
                      value={checkOut}
                      min={checkIn || props.windowStart || undefined}
                      max={props.windowEnd ?? undefined}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-brand-line px-3 py-2 text-sm text-brand-ink"
                    />
                  </label>
                  {props.windowStart && props.windowEnd ? (
                    <p className="col-span-full text-xs text-brand-mute">
                      Book any stay between {props.windowStart} and{" "}
                      {props.windowEnd}
                      {props.minNights
                        ? ` · ${props.minNights}${
                            props.maxNights ? `–${props.maxNights}` : "+"
                          } nights`
                        : ""}
                      .
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            {/* guests */}
            <section className="space-y-3 rounded-2xl border border-brand-line p-5">
              <h2 className="text-sm font-semibold text-brand-ink">Guests</h2>
              <select
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm text-brand-ink"
              >
                {Array.from({ length: props.maxGuests }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ),
                )}
              </select>
            </section>

            {/* add-ons */}
            {(props.requiredAddons.length > 0 ||
              props.optionalAddons.length > 0) && (
              <section className="space-y-3 rounded-2xl border border-brand-line p-5">
                <h2 className="text-sm font-semibold text-brand-ink">Extras</h2>
                {props.requiredAddons.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-brand-light px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        {a.name}{" "}
                        <span className="text-[11px] font-normal text-brand-mute">
                          (included)
                        </span>
                      </p>
                      {a.description ? (
                        <p className="text-xs text-brand-mute">
                          {a.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs text-brand-mute">
                      {formatMoney(a.unitPrice, a.currency)}
                    </span>
                  </div>
                ))}
                {props.optionalAddons.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-brand-line px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected[a.id]}
                        onChange={() => toggleAddon(a.id)}
                        className="h-4 w-4"
                      />
                      <div>
                        <p className="text-sm font-medium text-brand-ink">
                          {a.name}
                        </p>
                        {a.description ? (
                          <p className="text-xs text-brand-mute">
                            {a.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-xs text-brand-mute">
                      + {formatMoney(a.unitPrice, a.currency)}
                    </span>
                  </label>
                ))}
              </section>
            )}

            {/* your details */}
            <section className="space-y-3 rounded-2xl border border-brand-line p-5">
              <h2 className="text-sm font-semibold text-brand-ink">
                Your details
              </h2>
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                disabled={props.isAuthenticated}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm disabled:bg-brand-light"
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
              />
              {!props.isAuthenticated ? (
                <input
                  type="password"
                  placeholder="Create a password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
                />
              ) : null}
              <textarea
                placeholder="Special requests (optional)"
                value={requests}
                onChange={(e) => setRequests(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
              />
            </section>
          </>
        )}
      </div>

      {/* ── right: summary + pay ── */}
      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <div className="space-y-4 rounded-2xl border border-brand-line p-5">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-mute">
                {props.priceMode === "flat"
                  ? "Package"
                  : `${nights || props.minNights || 1} nights`}
              </span>
              <span className="text-brand-ink">
                {formatMoney(estimate.accommodation, props.currency)}
              </span>
            </div>
            {estimate.addons > 0 ? (
              <div className="flex justify-between">
                <span className="text-brand-mute">Extras</span>
                <span className="text-brand-ink">
                  {formatMoney(estimate.addons, props.currency)}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex items-baseline justify-between border-t border-brand-line pt-3">
            <span className="text-sm font-semibold text-brand-ink">
              Estimated total
            </span>
            <span className="font-display text-2xl font-extrabold text-brand-ink">
              {formatMoney(estimate.total, props.currency)}
            </span>
          </div>
          <p className="text-[11px] text-brand-mute">
            Final price is confirmed at payment.
          </p>

          {!soldOut ? (
            <>
              {/* payment method */}
              {methods.length > 0 ? (
                <div className="space-y-2">
                  {methods.map((m) => (
                    <label
                      key={m}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-brand-line px-3 py-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="method"
                        checked={method === m}
                        onChange={() => setMethod(m)}
                      />
                      {m === "paystack"
                        ? "Pay by card"
                        : "Pay by EFT (transfer)"}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-600">
                  This host hasn’t set up payments yet.
                </p>
              )}

              <label className="flex items-start gap-2 text-xs text-brand-mute">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I accept the booking terms and cancellation policy
                  {props.cancellationNote ? ` — ${props.cancellationNote}` : ""}
                  .
                </span>
              </label>

              {error ? (
                <p className="text-xs font-medium text-red-600">{error}</p>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={isPending || !canPay}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {method === "eft" ? "Book and pay by EFT" : "Confirm and pay"}
              </button>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
