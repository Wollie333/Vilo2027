"use client";

import { AlertTriangle, CalendarRange, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { formatMoney } from "@/lib/format";

import {
  changeBookingDatesAction,
  previewChangeDatesAction,
} from "./change-dates-actions";

export function ChangeDatesModal({
  open,
  onOpenChange,
  bookingId,
  initialCheckIn,
  initialCheckOut,
  currency,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookingId: string;
  initialCheckIn: string;
  initialCheckOut: string;
  currency: string;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [total, setTotal] = useState<string>("");
  const [manualEdit, setManualEdit] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [nights, setNights] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [saving, startSave] = useTransition();

  // Reset to the booking's current dates each time the modal opens.
  useEffect(() => {
    if (open) {
      setCheckIn(initialCheckIn);
      setCheckOut(initialCheckOut);
      setTotal("");
      setManualEdit(false);
      setAvailable(null);
      setNights(0);
    }
  }, [open, initialCheckIn, initialCheckOut]);

  // Auto-recalculate the suggested price whenever the dates change. The host can
  // then overwrite the total (manualEdit pins their value until dates change).
  const reqId = useRef(0);
  useEffect(() => {
    if (!open) return;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setAvailable(null);
      return;
    }
    const id = ++reqId.current;
    setPreviewing(true);
    previewChangeDatesAction({ bookingId, checkIn, checkOut })
      .then((res) => {
        if (id !== reqId.current) return; // a newer request superseded this one
        if (res.ok) {
          setAvailable(res.available);
          setNights(res.nights);
          if (!manualEdit && res.suggestedTotal != null) {
            setTotal(String(res.suggestedTotal));
          }
        } else {
          setAvailable(null);
          toast.error(res.error);
        }
      })
      .finally(() => {
        if (id === reqId.current) setPreviewing(false);
      });
    // manualEdit intentionally omitted: editing the total shouldn't re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId, checkIn, checkOut]);

  const totalNum = Number(total);
  const validTotal = Number.isFinite(totalNum) && totalNum >= 0;
  const canSave =
    available === true && checkOut > checkIn && validTotal && !previewing;

  function submit() {
    if (!canSave) return;
    startSave(async () => {
      const res = await changeBookingDatesAction({
        bookingId,
        checkIn,
        checkOut,
        total: totalNum,
      });
      if (res.ok) {
        toast.success("Booking dates updated.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Change dates"
      description="Moves the stay and re-prices for the new dates — you can override the total."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Check-in
            </label>
            <DatePicker
              value={checkIn}
              onChange={(iso) => {
                setCheckIn(iso);
                setManualEdit(false);
                if (checkOut <= iso) setCheckOut("");
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
              Check-out
            </label>
            <DatePicker
              value={checkOut}
              min={checkIn}
              onChange={(iso) => {
                setCheckOut(iso);
                setManualEdit(false);
              }}
            />
          </div>
        </div>

        {checkIn && checkOut && checkOut > checkIn ? (
          <div className="flex items-center gap-2 text-[12.5px]">
            <CalendarRange className="h-4 w-4 text-brand-mute" />
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

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
            Total ({currency})
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              setManualEdit(true);
            }}
            placeholder="0.00"
            className="w-full rounded-[11px] border border-brand-line bg-white px-[13px] py-[11px] text-[14px] tabular-nums text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/[0.12]"
          />
          <p className="mt-1.5 text-[11.5px] text-brand-mute">
            {manualEdit
              ? "Using your custom total."
              : "Auto-calculated for these dates — edit to override."}{" "}
            {validTotal ? formatMoney(totalNum, currency) : ""}
          </p>
        </div>
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={saving}>Cancel</FormModalCancel>
        <button
          type="button"
          onClick={submit}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-2 rounded-pill bg-brand-primary px-5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save dates
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
