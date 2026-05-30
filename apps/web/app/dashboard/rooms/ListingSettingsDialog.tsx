"use client";

import { Save, Settings2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import { setBookingModeAction } from "../listings/[id]/edit/actions";
import { BOOKING_MODES } from "../listings/[id]/edit/schemas";

export type BookingMode = "whole_listing" | "rooms_only" | "flexible";

export function ListingSettingsDialog({
  listingId,
  listingName,
  currentMode,
  onSaved,
}: {
  listingId: string;
  listingName: string;
  currentMode: BookingMode;
  onSaved: (mode: BookingMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BookingMode>(currentMode);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const result = await setBookingModeAction(listingId, {
        booking_mode: mode,
      });
      if (result.ok) {
        onSaved(mode);
        toast.success("Booking mode saved");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  // Reset local state when reopening so a cancel + reopen shows the saved
  // value, not whatever the user clicked last time.
  function onOpenChange(next: boolean) {
    if (next) setMode(currentMode);
    setOpen(next);
  }

  const dirty = mode !== currentMode;

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-accent"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Listing settings
      </button>
      <FormModal
        open={open}
        onOpenChange={onOpenChange}
        title={`Booking mode · ${listingName}`}
        description="How guests book this listing. Switch any time — the rooms you’ve added are kept either way."
        size="lg"
      >
        <div className="grid gap-3">
          {BOOKING_MODES.map((opt) => {
            const selected = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                disabled={pending}
                className={`flex items-start gap-3 rounded-card border p-4 text-left transition-colors ${
                  selected
                    ? "border-brand-primary bg-brand-accent/50"
                    : "border-brand-line bg-white hover:bg-brand-light/60"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 ${
                    selected
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line"
                  }`}
                >
                  {selected ? (
                    <span className="h-1.5 w-1.5 rounded-pill bg-white" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-semibold text-brand-dark">
                    {opt.label}
                    {opt.value === currentMode ? (
                      <span className="ml-1.5 rounded-pill bg-brand-line px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-brand-mute">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                    {opt.body}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <FormModalFooter>
          <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save booking mode"}
          </Button>
        </FormModalFooter>
      </FormModal>
    </>
  );
}
