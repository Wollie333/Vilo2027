"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ListingLocationForm } from "@/components/listing/ListingLocationForm";

import type { EditorListing } from "../Editor";

export function LocationTab({ listing }: { listing: EditorListing }) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const hasMapbox = mapboxToken.length > 3 && mapboxToken.startsWith("pk.");

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Location
        </CardTitle>
        <CardDescription className="text-brand-mute">
          {hasMapbox
            ? "Search an address to drop the pin — the fields below fill in automatically. Edit them if you need to fine-tune."
            : "Address fields only — set NEXT_PUBLIC_MAPBOX_TOKEN to switch on the search-and-pin picker."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ListingLocationForm
          listing={{
            id: listing.id,
            address_line1: listing.address_line1,
            address_line2: listing.address_line2,
            city: listing.city,
            province: listing.province,
            postal_code: listing.postal_code,
            latitude: listing.latitude,
            longitude: listing.longitude,
          }}
        />
      </CardContent>
    </Card>
  );
}
