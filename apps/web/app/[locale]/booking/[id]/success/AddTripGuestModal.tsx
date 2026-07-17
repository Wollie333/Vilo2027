"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import { addTripGuestAction } from "../actions";

const inputCls =
  "w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15";

/**
 * Lets the booker add someone to their party after booking. Capped at the
 * booking's guest count — the button hides once the party is full.
 */
export function AddTripGuestModal({
  bookingId,
  partyCount,
  guestsCount,
}: {
  bookingId: string;
  /** Party members already on the booking (excludes the lead booker). */
  partyCount: number;
  /** Guests the booking was made for (the lead booker is one of them). */
  guestsCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [isPending, start] = useTransition();

  const remaining = Math.max(0, guestsCount - 1 - partyCount);
  if (remaining === 0) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addTripGuestAction(bookingId, form);
      if (res.ok) {
        toast.success(`${res.name} was added to your trip.`);
        setForm({ name: "", email: "", phone: "" });
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-brand-line bg-white px-4 py-3 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
      >
        <UserPlus className="h-4 w-4 text-brand-primary" />
        Add someone to your trip
        <span className="text-[11px] font-normal text-brand-mute">
          {remaining} {remaining === 1 ? "space" : "spaces"} left
        </span>
      </button>

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Add someone to your trip"
        description={`They'll get their own Wielo account so your host can reach them. ${remaining} ${remaining === 1 ? "space" : "spaces"} left on this booking.`}
        size="sm"
      >
        <form id="add-trip-guest" onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Full name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Amara Okafor"
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((s) => ({ ...s, email: e.target.value }))
              }
              placeholder="amara@example.com"
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Phone{" "}
              <span className="font-normal text-brand-mute">(optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((s) => ({ ...s, phone: e.target.value }))
              }
              placeholder="+27 82 000 0000"
              autoComplete="off"
              className={inputCls}
            />
          </div>
        </form>
        <FormModalFooter>
          <FormModalCancel>Cancel</FormModalCancel>
          <button
            type="submit"
            form="add-trip-guest"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adding…
              </>
            ) : (
              "Add to trip"
            )}
          </button>
        </FormModalFooter>
      </FormModal>
    </>
  );
}
