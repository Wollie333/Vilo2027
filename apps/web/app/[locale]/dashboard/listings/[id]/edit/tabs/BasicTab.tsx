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

import { assignListingBusinessAction, setBookingModeAction } from "../actions";
import type { EditorListing } from "../Editor";
import { BOOKING_MODES } from "../schemas";

export function BasicTab({
  listing,
  categoryLeaves,
  businesses,
}: {
  listing: EditorListing;
  categoryLeaves: CategoryPickerLeaf[];
  businesses: { id: string; name: string }[];
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
              description: listing.description ?? "",
            }}
            categoryLeaves={categoryLeaves}
          />
        </CardContent>
      </Card>

      <BusinessCard listing={listing} businesses={businesses} />
      <BookingModeCard listing={listing} />
    </div>
  );
}

function BusinessCard({
  listing,
  businesses,
}: {
  listing: EditorListing;
  businesses: { id: string; name: string }[];
}) {
  const [businessId, setBusinessId] = useState<string>(
    listing.business_id ?? "",
  );
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const result = await assignListingBusinessAction(listing.id, businessId);
      if (result.ok) {
        toast.success("Business updated");
      } else {
        toast.error(result.error);
        setBusinessId(listing.business_id ?? "");
      }
    });
  }

  const dirty = businessId !== (listing.business_id ?? "");

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Business
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Which of your businesses owns this listing. Its name, VAT, address,
          banking and currency appear on this listing&rsquo;s quotes and
          invoices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Owning business
            </label>
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              disabled={pending}
              className="focus-ring w-full appearance-none rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink transition"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save business"}
          </Button>
        </div>
        {businesses.length <= 1 ? (
          <p className="mt-2 text-xs text-brand-mute">
            Add more businesses under Settings → Businesses to assign listings
            to different companies.
          </p>
        ) : null}
      </CardContent>
    </Card>
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
