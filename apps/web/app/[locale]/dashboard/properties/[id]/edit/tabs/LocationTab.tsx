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
  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Location
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Search an address or click the map to drop the pin — the fields below
          fill in automatically. Edit them if you need to fine-tune.
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
