"use client";

import { Loader2, Lock, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  computeAddonSubtotal,
  defaultAddonQuantity,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import { commerceParams, firePixelEvent } from "@/lib/analytics/pixel";
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
  propertyId: string;
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
  hasPaypal: boolean;
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
  const t = useTranslations("specials");
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

  const methods: ("paystack" | "eft" | "paypal")[] = [
    ...(props.hasPaystack ? (["paystack"] as const) : []),
    ...(props.hasPaypal ? (["paypal"] as const) : []),
    ...(props.hasEftBanking ? (["eft"] as const) : []),
  ];
  const [method, setMethod] = useState<"paystack" | "eft" | "paypal">(
    methods[0] ?? "paystack",
  );
  // Meta AddPaymentInfo — fires once on first payment-method pick. DIRECTORY
  // (Wielo) checkout → reaches the Wielo pixel.
  const apiFiredRef = useRef(false);
  function selectMethod(m: "paystack" | "eft" | "paypal") {
    setMethod(m);
    if (apiFiredRef.current) return;
    apiFiredRef.current = true;
    firePixelEvent("AddPaymentInfo", {
      ...commerceParams({
        contentIds: [props.propertyId],
        contentName: props.propertyName,
        currency: props.currency,
        ...(estimate.total > 0 ? { value: estimate.total } : {}),
      }),
      payment_method: m,
    });
  }
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
    if (soldOut) return t("bkErrSoldOut");
    if (!datesReady) return t("bkErrDates");
    if (props.dateMode === "flexible") {
      if (props.windowStart && checkIn < props.windowStart)
        return t("bkErrBeforeWindow");
      if (props.windowEnd && checkOut > props.windowEnd)
        return t("bkErrAfterWindow");
      if (props.minNights && nights < props.minNights)
        return t("bkErrMinNights", { count: props.minNights });
      if (props.maxNights && nights > props.maxNights)
        return t("bkErrMaxNights", { count: props.maxNights });
    }
    if (!props.isAuthenticated) {
      if (name.trim().length < 2) return t("bkErrName");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return t("bkErrEmail");
      if (password.length < 8) return t("bkErrPassword");
    }
    if (!ack) return t("bkErrAck");
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
                {t("bkSave", {
                  amount: formatMoney(props.savingsAmount, props.currency),
                  pct: props.savingsPct,
                })}
                {props.wasPrice ? (
                  <span className="ml-1 font-normal text-brand-mute line-through">
                    {formatMoney(props.wasPrice, props.currency)}
                  </span>
                ) : null}
              </p>
            ) : null}
            {!soldOut && props.remaining <= 5 ? (
              <p className="text-xs font-medium text-amber-600">
                {t("onlyLeft", { count: props.remaining })}
              </p>
            ) : null}
          </div>
        </div>

        {soldOut ? (
          <div className="rounded-2xl border border-brand-line bg-brand-light p-5 text-sm text-brand-mute">
            {t("bkErrSoldOut")}
          </div>
        ) : (
          <>
            {/* dates */}
            <section className="space-y-3 rounded-2xl border border-brand-line p-5">
              <h2 className="text-sm font-semibold text-brand-ink">
                {t("bkYourDates")}
              </h2>
              {props.dateMode === "fixed" ? (
                <p className="text-sm text-brand-ink">
                  {props.fixedCheckIn} → {props.fixedCheckOut}{" "}
                  <span className="text-brand-mute">
                    (
                    {t("bkFixedNights", {
                      nights: nightsBetween(
                        props.fixedCheckIn ?? "",
                        props.fixedCheckOut ?? "",
                      ),
                    })}
                    )
                  </span>
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-brand-mute">
                    {t("bkCheckIn")}
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
                    {t("bkCheckOut")}
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
                      {t("dtFlexRange", {
                        start: props.windowStart,
                        end: props.windowEnd,
                      })}
                      {props.minNights
                        ? t("dtNightsRange", {
                            min: props.minNights,
                            max: props.maxNights ? `–${props.maxNights}` : "+",
                          })
                        : ""}
                      .
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            {/* guests */}
            <section className="space-y-3 rounded-2xl border border-brand-line p-5">
              <h2 className="text-sm font-semibold text-brand-ink">
                {t("bkGuests")}
              </h2>
              <select
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm text-brand-ink"
              >
                {Array.from({ length: props.maxGuests }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {t("bkGuestCount", { count: n })}
                    </option>
                  ),
                )}
              </select>
            </section>

            {/* add-ons */}
            {(props.requiredAddons.length > 0 ||
              props.optionalAddons.length > 0) && (
              <section className="space-y-3 rounded-2xl border border-brand-line p-5">
                <h2 className="text-sm font-semibold text-brand-ink">
                  {t("bkExtras")}
                </h2>
                {props.requiredAddons.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-brand-light px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        {a.name}{" "}
                        <span className="text-[11px] font-normal text-brand-mute">
                          {t("bkIncludedTag")}
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
                {t("bkYourDetails")}
              </h2>
              <input
                type="text"
                placeholder={t("bkFullName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder={t("bkEmail")}
                value={email}
                disabled={props.isAuthenticated}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm disabled:bg-brand-light"
              />
              <input
                type="tel"
                placeholder={t("bkPhone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
              />
              {!props.isAuthenticated ? (
                <input
                  type="password"
                  placeholder={t("bkPassword")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
                />
              ) : null}
              <textarea
                placeholder={t("bkRequests")}
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
                  ? t("bkPackage")
                  : t("bkNights", { count: nights || props.minNights || 1 })}
              </span>
              <span className="text-brand-ink">
                {formatMoney(estimate.accommodation, props.currency)}
              </span>
            </div>
            {estimate.addons > 0 ? (
              <div className="flex justify-between">
                <span className="text-brand-mute">{t("bkExtras")}</span>
                <span className="text-brand-ink">
                  {formatMoney(estimate.addons, props.currency)}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex items-baseline justify-between border-t border-brand-line pt-3">
            <span className="text-sm font-semibold text-brand-ink">
              {t("bkEstimatedTotal")}
            </span>
            <span className="font-display text-2xl font-extrabold text-brand-ink">
              {formatMoney(estimate.total, props.currency)}
            </span>
          </div>
          <p className="text-[11px] text-brand-mute">{t("bkFinalNote")}</p>

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
                        onChange={() => selectMethod(m)}
                      />
                      {m === "paystack"
                        ? t("bkPayCard")
                        : m === "paypal"
                          ? "PayPal (USD)"
                          : t("bkPayEft")}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-600">{t("bkNoPayments")}</p>
              )}

              <label className="flex items-start gap-2 text-xs text-brand-mute">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  {t("bkAck", {
                    note: props.cancellationNote
                      ? t("bkAckNote", { note: props.cancellationNote })
                      : "",
                  })}
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
                {method === "eft" ? t("bkSubmitEft") : t("bkSubmitCard")}
              </button>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
