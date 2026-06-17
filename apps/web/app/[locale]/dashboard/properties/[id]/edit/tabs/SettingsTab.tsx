"use client";

import { Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

import { saveListingPatchAction } from "../actions";
import type { EditorListing } from "../Editor";

export function SettingsTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  // Auto-save on toggle — no separate "Save" step to forget. The public
  // listing shows the Instant-book pill the moment this is on.
  const [instant, setInstant] = useState(listing.instant_booking);

  function persist(value: boolean) {
    setInstant(value);
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        instant_booking: value,
      });
      if (result.ok) {
        toast.success(value ? "Instant booking on" : "Instant booking off");
      } else {
        toast.error(result.error);
        setInstant(!value); // revert on failure
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Booking settings
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Toggle instant booking on once you&rsquo;re comfortable accepting
          unknown guests on the spot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-card border border-brand-line bg-white p-4 hover:bg-brand-light/60">
            <Checkbox
              checked={instant}
              onCheckedChange={(v) => persist(v === true)}
              disabled={pending}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-secondary" />
                <span className="text-sm font-semibold text-brand-dark">
                  Allow instant booking
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                Approved guests can book without waiting for your confirmation.
                Saves automatically — your listing shows an &ldquo;Instant
                book&rdquo; pill while this is on. Switch off any time.
              </p>
            </div>
          </label>

          <div className="rounded border border-brand-line bg-brand-accent/40 p-4 text-xs text-brand-ink">
            <div className="font-semibold text-brand-dark">Payment methods</div>
            <p className="mt-1 leading-relaxed text-brand-mute">
              All listings accept Paystack (cards + instant EFT) and manual EFT
              once the booking flow ships in Phase 2. PayPal opens on Pro and
              above.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
