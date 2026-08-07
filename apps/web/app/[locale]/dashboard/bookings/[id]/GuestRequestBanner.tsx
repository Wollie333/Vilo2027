"use client";

import {
  AlertTriangle,
  BedDouble,
  CalendarRange,
  Check,
  ChevronRight,
  Loader2,
  RotateCcw,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DatePicker } from "@/components/ui/date-picker";
import { formatMoney } from "@/lib/format";

import {
  counterBookingChangeAction,
  declineBookingChangeAction,
  previewBookingUpdateAction,
  quoteBookingChangeAction,
} from "./guest-request-actions";

type Settlement = "refund" | "credit" | "none";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PropertyRoomLite = {
  id: string;
  name: string;
  basePrice: number;
  maxGuests: number;
};

export type OpenChangeRequest = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  guestMessage: string | null;
  createdAt: string;
  /** A quote has already been sent — awaiting the guest's accept/decline. */
  hasQuote: boolean;
  /** Seasonal suggested total for the change (host may override). */
  suggestedTotal: number | null;
  /** Net already paid — the settlement basis. */
  netPaid: number;
  /** suggestedTotal − netPaid: >0 guest owes more, <0 a refund/credit is due. */
  delta: number | null;
  currency: string;
  /** Booking pricing scope — "rooms" listings expose the room editor. */
  scope: string;
  /** The booking's dates BEFORE the change (for the current → new summary). */
  currentCheckIn: string | null;
  currentCheckOut: string | null;
  currentGuests: number;
  /** Room IDs currently on the booking (rooms scope). */
  currentRoomIds: string[];
  /** The property's active rooms the host can add/drop (rooms scope). */
  propertyRooms: PropertyRoomLite[];
};

export type OpenRefundRequest = {
  id: string;
  amount: number;
  currency: string;
  reason: string | null;
  createdAt: string;
};

/**
 * Host-facing banner: everything the guest is waiting on for this booking —
 * date/add-guest change requests (review, edit + quote inline, or decline) and
 * open refund requests (review on the refund page). Mirrors the amber "action
 * needed" workflow cards already on the booking detail.
 */
export function GuestRequestBanner({
  changeRequests,
  refundRequests,
}: {
  changeRequests: OpenChangeRequest[];
  refundRequests: OpenRefundRequest[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [declining, setDeclining] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [cIn, setCIn] = React.useState("");
  const [cOut, setCOut] = React.useState("");
  const [pending, start] = React.useTransition();

  // Which request's quote editor is open.
  const [quoting, setQuoting] = React.useState<string | null>(null);

  if (changeRequests.length === 0 && refundRequests.length === 0) return null;

  function confirmDecline(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await declineBookingChangeAction(
        id,
        reason.trim() || undefined,
      );
      setBusyId(null);
      if (res.ok) {
        toast.success("Request declined — the guest has been notified.");
        setDeclining(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function confirmCounter(id: string) {
    if (!cIn || !cOut) {
      toast.error("Pick both suggested dates.");
      return;
    }
    setBusyId(id);
    start(async () => {
      const res = await counterBookingChangeAction(id, {
        checkIn: cIn,
        checkOut: cOut,
        note: reason.trim() || undefined,
      });
      setBusyId(null);
      if (res.ok) {
        toast.success(
          "Suggested dates sent — the guest will accept or decline.",
        );
        setDeclining(null);
        setReason("");
        setCIn("");
        setCOut("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-amber-300 bg-amber-50/60 shadow-card">
      <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3">
        <span className="flex h-2 w-2 rounded-full bg-amber-500" />
        <span className="font-display text-[14px] font-bold text-amber-900">
          Guest requests awaiting you
        </span>
        <span className="rounded-pill bg-amber-200 px-1.5 py-px text-[10.5px] font-semibold text-amber-800">
          {changeRequests.length + refundRequests.length}
        </span>
      </div>

      <div className="divide-y divide-amber-200/70">
        {changeRequests.map((r) => {
          const isDate = r.type === "date_change";
          const summary = isDate
            ? `New dates: ${String(r.payload?.check_in ?? "?")} → ${String(
                r.payload?.check_out ?? "?",
              )}`
            : `Add a guest: ${String(r.payload?.full_name ?? "—")}`;
          const detail = isDate
            ? r.guestMessage
            : [
                r.payload?.email as string | undefined,
                r.payload?.phone as string | undefined,
                r.guestMessage,
              ]
                .filter(Boolean)
                .join(" · ");
          return (
            <div key={r.id} className="px-5 py-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
                  {isDate ? (
                    <CalendarRange className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {isDate ? "Date change requested" : "Add a guest requested"}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-brand-ink">
                    {summary}
                  </div>
                  {detail ? (
                    <div className="mt-0.5 text-[12px] text-brand-mute">
                      {detail}
                    </div>
                  ) : null}
                </div>
              </div>

              {declining === r.id ? (
                <div className="mt-3 space-y-2.5">
                  {isDate ? (
                    <div className="rounded-[10px] border border-brand-line bg-white p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                        Suggest alternative dates (optional)
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <DatePicker
                          value={cIn}
                          onChange={(iso) => {
                            setCIn(iso);
                            if (cOut && cOut <= iso) setCOut("");
                          }}
                          aria-label="Suggested check-in"
                        />
                        <DatePicker
                          value={cOut}
                          min={cIn}
                          onChange={(iso) => setCOut(iso)}
                          aria-label="Suggested check-out"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => confirmCounter(r.id)}
                        disabled={pending || !cIn || !cOut}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
                      >
                        {busyId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CalendarRange className="h-3.5 w-3.5" />
                        )}
                        Suggest these dates
                      </button>
                    </div>
                  ) : null}
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, 500))}
                    placeholder={
                      isDate
                        ? "Note to the guest (shared with a suggestion or a plain decline)"
                        : "Reason for declining (optional, shared with the guest)"
                    }
                    className="block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeclining(null)}
                      disabled={pending}
                      className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDecline(r.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-status-cancelled px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Decline without a suggestion
                    </button>
                  </div>
                </div>
              ) : r.hasQuote ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-white px-2.5 py-1 text-[11.5px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  <Loader2 className="h-3 w-3" /> Quote sent — awaiting the
                  guest
                </div>
              ) : quoting === r.id ? (
                <QuoteEditor
                  request={r}
                  onCancel={() => setQuoting(null)}
                  onSent={() => {
                    setQuoting(null);
                    router.refresh();
                  }}
                />
              ) : (
                <div className="mt-3">
                  {r.delta != null ? (
                    <div className="mb-2 text-[12px] text-brand-mute">
                      New total{" "}
                      {r.suggestedTotal != null ? (
                        <span className="font-semibold text-brand-ink">
                          {formatMoney(r.suggestedTotal, r.currency)}
                        </span>
                      ) : (
                        "—"
                      )}
                      {Math.abs(r.delta) >= 0.01 ? (
                        <>
                          {" · "}
                          {r.delta > 0 ? "guest pays" : "back to guest"}{" "}
                          <span className="font-semibold text-brand-ink">
                            {formatMoney(Math.abs(r.delta), r.currency)}
                          </span>
                        </>
                      ) : (
                        " · no change"
                      )}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuoting(r.id);
                        setDeclining(null);
                      }}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-status-confirmed px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" /> Review &amp; quote
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeclining(r.id);
                        setReason("");
                        setCIn("");
                        setCOut("");
                      }}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {refundRequests.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/payments/refunds/${r.id}`}
            className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-amber-100/50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-brand-ink">
                Refund requested · {formatMoney(r.amount, r.currency)}
              </div>
              {r.reason ? (
                <div className="mt-0.5 text-[12px] text-brand-mute">
                  {r.reason}
                </div>
              ) : null}
            </div>
            <span className="text-[12px] font-medium text-brand-primary">
              Review
            </span>
            <ChevronRight className="h-4 w-4 text-brand-mute" />
          </Link>
        ))}
      </div>
    </div>
  );
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function nightsBetween(a: string, b: string): number {
  if (!ISO.test(a) || !ISO.test(b)) return 0;
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

/**
 * The full in-context editor behind "Review & quote". The host sees the booking's
 * current dates / guests / rooms against the requested ones, can edit any of them,
 * watches the seasonal total reprice live, then confirms a total (auto-filled from
 * the seasonal suggestion, overridable) and how any reduction is settled. Sending
 * stores the confirmed change on the request as a quote for the guest to accept.
 */
function QuoteEditor({
  request: r,
  onCancel,
  onSent,
}: {
  request: OpenChangeRequest;
  onCancel: () => void;
  onSent: () => void;
}) {
  const isRooms = r.scope === "rooms";
  const reqCheckIn = (r.payload?.check_in as string | undefined) ?? null;
  const reqCheckOut = (r.payload?.check_out as string | undefined) ?? null;
  const reqGuests = Number(r.payload?.guests_count) || null;

  // Seed the editor with what the guest asked for, falling back to the booking's
  // current values (a date change seeds the requested dates; an add-guest seeds
  // the current dates + requested headcount).
  const [checkIn, setCheckIn] = React.useState(
    reqCheckIn ?? r.currentCheckIn ?? "",
  );
  const [checkOut, setCheckOut] = React.useState(
    reqCheckOut ?? r.currentCheckOut ?? "",
  );
  const [guests, setGuests] = React.useState<number>(
    reqGuests ?? r.currentGuests ?? 1,
  );
  const [roomIds, setRoomIds] = React.useState<string[]>(r.currentRoomIds);

  const [total, setTotal] = React.useState("");
  const [manualEdit, setManualEdit] = React.useState(false);
  const [settlement, setSettlement] = React.useState<Settlement>("refund");

  // Live preview state.
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [newTotal, setNewTotal] = React.useState<number | null>(null);
  const [netPaid, setNetPaid] = React.useState<number>(r.netPaid);
  const [previewing, setPreviewing] = React.useState(false);
  const [sending, start] = React.useTransition();

  const nights = nightsBetween(checkIn, checkOut);
  const roomKey = roomIds.slice().sort().join(",");

  // Reprice on any edit. Supersede stale responses via reqId (a fast host can
  // change dates/rooms faster than the server answers).
  const reqIdRef = React.useRef(0);
  React.useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setAvailable(null);
      setNewTotal(null);
      return;
    }
    if (isRooms && roomIds.length === 0) {
      setAvailable(null);
      setNewTotal(null);
      return;
    }
    const id = ++reqIdRef.current;
    setPreviewing(true);
    previewBookingUpdateAction(r.id, {
      checkIn,
      checkOut,
      guestsCount: guests,
      roomIds: isRooms ? roomIds : undefined,
    })
      .then((res) => {
        if (id !== reqIdRef.current) return;
        if (res.ok) {
          setAvailable(res.available);
          setNewTotal(res.newTotal);
          setNetPaid(res.netPaid);
          if (!manualEdit && res.newTotal != null) {
            setTotal(String(round2(res.newTotal)));
          }
        } else {
          setAvailable(null);
          setNewTotal(null);
          toast.error(res.error);
        }
      })
      .finally(() => {
        if (id === reqIdRef.current) setPreviewing(false);
      });
    // manualEdit intentionally excluded: overriding the total shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, checkIn, checkOut, guests, roomKey, isRooms]);

  const totalNum = Number(total);
  const validTotal = Number.isFinite(totalNum) && totalNum >= 0;
  const delta = validTotal ? round2(totalNum - netPaid) : null;
  const isReduction = delta != null && delta < -0.009;
  const canSend =
    validTotal &&
    available === true &&
    !previewing &&
    checkOut > checkIn &&
    (!isRooms || roomIds.length > 0);

  function toggleRoom(id: string) {
    setManualEdit(false);
    setRoomIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function send() {
    if (!canSend) {
      toast.error("Pick valid dates, rooms and a price first.");
      return;
    }
    start(async () => {
      const res = await quoteBookingChangeAction(r.id, {
        total: round2(totalNum),
        settlement: isReduction ? settlement : "charge",
        checkIn,
        checkOut,
        guestsCount: guests,
        roomIds: isRooms ? roomIds : undefined,
      });
      if (res.ok) {
        toast.success("Quote sent — the guest can accept or decline.");
        onSent();
      } else {
        toast.error(res.error);
      }
    });
  }

  const datesChanged =
    checkIn !== (r.currentCheckIn ?? "") ||
    checkOut !== (r.currentCheckOut ?? "");
  const guestsChanged = guests !== r.currentGuests;
  const roomsChanged = roomKey !== r.currentRoomIds.slice().sort().join(",");

  return (
    <div className="mt-3 space-y-3 rounded-[10px] border border-brand-line bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        Review &amp; quote
      </div>

      {/* Current → New summary */}
      <div className="space-y-1 rounded-[8px] bg-brand-light/60 p-2.5 text-[12px]">
        <SummaryRow
          icon={<CalendarRange className="h-3.5 w-3.5" />}
          label="Dates"
          from={
            r.currentCheckIn && r.currentCheckOut
              ? `${r.currentCheckIn} → ${r.currentCheckOut}`
              : "—"
          }
          to={checkIn && checkOut ? `${checkIn} → ${checkOut}` : "—"}
          changed={datesChanged}
        />
        <SummaryRow
          icon={<Users className="h-3.5 w-3.5" />}
          label="Guests"
          from={String(r.currentGuests)}
          to={String(guests)}
          changed={guestsChanged}
        />
        {isRooms ? (
          <SummaryRow
            icon={<BedDouble className="h-3.5 w-3.5" />}
            label="Rooms"
            from={String(r.currentRoomIds.length)}
            to={String(roomIds.length)}
            changed={roomsChanged}
          />
        ) : null}
      </div>

      {/* Editable dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-brand-ink">
            Check-in
          </label>
          <DatePicker
            value={checkIn}
            onChange={(iso) => {
              setCheckIn(iso);
              setManualEdit(false);
              if (checkOut && checkOut <= iso) setCheckOut("");
            }}
            aria-label="New check-in"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-brand-ink">
            Check-out
          </label>
          <DatePicker
            value={checkOut}
            min={checkIn}
            onChange={(iso) => {
              setCheckOut(iso);
              setManualEdit(false);
            }}
            aria-label="New check-out"
          />
        </div>
      </div>

      {checkIn && checkOut && checkOut > checkIn ? (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-brand-mute">
            {nights} night{nights === 1 ? "" : "s"}
          </span>
          {previewing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-mute" />
          ) : available === false ? (
            <span className="inline-flex items-center gap-1 font-semibold text-status-cancelled">
              <AlertTriangle className="h-3.5 w-3.5" /> Not available
            </span>
          ) : available === true ? (
            <span className="inline-flex items-center gap-1 font-semibold text-status-confirmed">
              <Check className="h-3.5 w-3.5" /> Available
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Guests */}
      <div className="flex items-center justify-between gap-3">
        <label className="text-[11px] font-semibold text-brand-ink">
          Guests
        </label>
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={guests}
          onChange={(e) => {
            const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
            setGuests(n);
            setManualEdit(false);
          }}
          className="w-20 rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] tabular-nums text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
        />
      </div>

      {/* Rooms (rooms-scoped listings) */}
      {isRooms && r.propertyRooms.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-brand-ink">
            Rooms
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.propertyRooms.map((room) => {
              const on = roomIds.includes(room.id);
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleRoom(room.id)}
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-medium transition ${
                    on
                      ? "border-brand-primary bg-brand-accent text-brand-primary"
                      : "border-brand-line bg-white text-brand-mute hover:bg-brand-light"
                  }`}
                >
                  {on ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <BedDouble className="h-3 w-3" />
                  )}
                  {room.name}
                  <span className="text-[10.5px] opacity-70">
                    {formatMoney(room.basePrice, r.currency)}
                  </span>
                </button>
              );
            })}
          </div>
          {roomIds.length === 0 ? (
            <p className="mt-1 text-[11px] text-status-cancelled">
              Pick at least one room.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Seasonal estimate */}
      <div className="text-[12px] text-brand-mute">
        {previewing ? (
          "Pricing…"
        ) : newTotal != null ? (
          <>
            Seasonal suggested total{" "}
            <span className="font-semibold text-brand-ink">
              {formatMoney(newTotal, r.currency)}
            </span>{" "}
            · already paid {formatMoney(netPaid, r.currency)}
          </>
        ) : available === false ? (
          "Not available for these dates."
        ) : (
          "Set the dates to see the seasonal price."
        )}
      </div>

      {/* New total (auto-filled, overridable) */}
      <div>
        <div className="flex items-end justify-between gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            New total ({r.currency})
          </label>
          {manualEdit && newTotal != null ? (
            <button
              type="button"
              onClick={() => {
                setManualEdit(false);
                setTotal(String(round2(newTotal)));
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-primary hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Reset to seasonal
            </button>
          ) : null}
        </div>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={total}
          onChange={(e) => {
            setTotal(e.target.value);
            setManualEdit(true);
          }}
          className="mt-1 block w-40 rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] tabular-nums text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
        />
      </div>

      {/* Delta + settlement */}
      {delta != null && total !== "" ? (
        delta > 0.009 ? (
          <div className="text-[12px] text-brand-ink">
            Guest pays an extra{" "}
            <span className="font-semibold">
              {formatMoney(delta, r.currency)}
            </span>{" "}
            on accept.
          </div>
        ) : delta < -0.009 ? (
          <div className="space-y-1.5">
            <div className="text-[12px] text-brand-ink">
              <span className="font-semibold">
                {formatMoney(-delta, r.currency)}
              </span>{" "}
              back to the guest — how?
            </div>
            <div className="flex flex-wrap gap-2">
              {(["refund", "credit", "none"] as Settlement[]).map((s) => (
                <label
                  key={s}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-medium ${
                    settlement === s
                      ? "border-brand-primary bg-brand-accent text-brand-primary"
                      : "border-brand-line bg-white text-brand-mute"
                  }`}
                >
                  <input
                    type="radio"
                    name={`stl-${r.id}`}
                    checked={settlement === s}
                    onChange={() => setSettlement(s)}
                    className="sr-only"
                  />
                  {s === "refund"
                    ? "Refund"
                    : s === "credit"
                      ? "Credit"
                      : "No change"}
                </label>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-brand-mute">
              Refund is sent by you from your own account. Credit is store
              credit for this guest. No change keeps the full amount.
            </p>
          </div>
        ) : (
          <div className="text-[12px] text-brand-mute">No price change.</div>
        )
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={!canSend || sending}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Send quote
        </button>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  from,
  to,
  changed,
}: {
  icon: React.ReactNode;
  label: string;
  from: string;
  to: string;
  changed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-brand-mute">{icon}</span>
      <span className="w-12 shrink-0 text-brand-mute">{label}</span>
      <span className="text-brand-mute line-through decoration-brand-mute/40">
        {from}
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-brand-mute" />
      <span
        className={
          changed ? "font-semibold text-brand-primary" : "text-brand-ink"
        }
      >
        {to}
      </span>
    </div>
  );
}
