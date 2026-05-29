"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ListingBasicsForm } from "@/components/listing/ListingBasicsForm";
import { type CategoryPickerLeaf } from "@/lib/taxonomy/CategoryPicker";

import { setBookingModeAction } from "../actions";
import type { EditorListing } from "../Editor";
import { BOOKING_MODES } from "../schemas";

export function BasicTab({
  listing,
  categoryLeaves,
}: {
  listing: EditorListing;
  categoryLeaves: CategoryPickerLeaf[];
}) {
  return (
    <div className="space-y-6">
      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Basic info
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Name, category and description guests will read first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListingBasicsForm
            listing={{
              id: listing.id,
              listing_type: listing.listing_type,
              name: listing.name,
              category_id: listing.category_id ?? null,
              accommodation_type: listing.accommodation_type,
              experience_type: listing.experience_type,
              description: listing.description ?? "",
            }}
            categoryLeaves={categoryLeaves}
          />
        </CardContent>
      </Card>

      {listing.listing_type === "accommodation" ? (
        <BookingModeCard listing={listing} />
      ) : null}
    </div>
  );
}

function BookingModeCard({ listing }: { listing: EditorListing }) {
  const [mode, setMode] = useState<EditorListing["booking_mode"]>(
    listing.booking_mode,
  );
  const [savePending, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const result = await setBookingModeAction(listing.id, {
        booking_mode: mode,
      });
      if (result.ok) {
        toast.success("Booking mode saved");
      } else {
        toast.error(result.error);
        setMode(listing.booking_mode);
      }
    });
  }

  const dirty = mode !== listing.booking_mode;

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Booking mode
        </CardTitle>
        <CardDescription className="text-brand-mute">
          How guests book this place. Switch any time — rooms you&rsquo;ve added
          are kept either way.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {BOOKING_MODES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              disabled={savePending}
              className={`rounded-card border p-4 text-left transition-colors ${
                mode === opt.value
                  ? "border-brand-primary bg-brand-accent/50"
                  : "border-brand-line bg-white hover:bg-brand-light/60"
              }`}
            >
              <div className="font-display text-sm font-semibold text-brand-dark">
                {opt.label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                {opt.body}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || savePending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {savePending ? "Saving…" : "Save booking mode"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
