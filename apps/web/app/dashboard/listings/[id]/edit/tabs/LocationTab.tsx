"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LocationPicker } from "@/components/location/LocationPicker";

import { saveListingPatchAction } from "../actions";
import type { EditorListing } from "../Editor";
import { SA_PROVINCES, locationSchema, type LocationInput } from "../schemas";

function emptyToNull(v: string): string | null {
  return v.length > 0 ? v : null;
}

function strToNum(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function LocationTab({ listing }: { listing: EditorListing }) {
  const [pending, start] = useTransition();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  // The placeholder value in .env.example is "pk." — treat that as missing
  // so the picker only renders when a real token is configured.
  const hasMapbox = mapboxToken.length > 3 && mapboxToken.startsWith("pk.");

  const form = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      address_line1: listing.address_line1 ?? "",
      address_line2: listing.address_line2 ?? "",
      city: listing.city ?? "",
      province: listing.province ?? "",
      postal_code: listing.postal_code ?? "",
      latitude: listing.latitude == null ? "" : String(listing.latitude),
      longitude: listing.longitude == null ? "" : String(listing.longitude),
    },
  });

  const watchedLat = form.watch("latitude");
  const watchedLng = form.watch("longitude");
  const latNum = watchedLat === "" ? null : Number(watchedLat);
  const lngNum = watchedLng === "" ? null : Number(watchedLng);
  const pickerLat = latNum != null && Number.isFinite(latNum) ? latNum : null;
  const pickerLng = lngNum != null && Number.isFinite(lngNum) ? lngNum : null;

  function onSubmit(values: LocationInput) {
    start(async () => {
      const result = await saveListingPatchAction(listing.id, {
        address_line1: emptyToNull(values.address_line1),
        address_line2: emptyToNull(values.address_line2),
        city: emptyToNull(values.city),
        province: emptyToNull(values.province),
        postal_code: emptyToNull(values.postal_code),
        latitude: strToNum(values.latitude),
        longitude: strToNum(values.longitude),
      });
      if (result.ok) toast.success("Location saved");
      else toast.error(result.error);
    });
  }

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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {hasMapbox ? (
              <LocationPicker
                latitude={pickerLat}
                longitude={pickerLng}
                token={mapboxToken}
                onSelect={(sel) => {
                  form.setValue("address_line1", sel.address_line1, {
                    shouldDirty: true,
                  });
                  if (sel.city) {
                    form.setValue("city", sel.city, { shouldDirty: true });
                  }
                  if (sel.province) {
                    form.setValue("province", sel.province, {
                      shouldDirty: true,
                    });
                  }
                  if (sel.postal_code) {
                    form.setValue("postal_code", sel.postal_code, {
                      shouldDirty: true,
                    });
                  }
                  form.setValue("latitude", String(sel.latitude), {
                    shouldDirty: true,
                  });
                  form.setValue("longitude", String(sel.longitude), {
                    shouldDirty: true,
                  });
                }}
              />
            ) : null}

            <FormField
              control={form.control}
              name="address_line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street address</FormLabel>
                  <FormControl>
                    <Input placeholder="42 Long Street" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address_line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Suite / unit{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / town</FormLabel>
                    <FormControl>
                      <Input placeholder="Cape Town" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      >
                        <option value="">Pick a province</option>
                        {SA_PROVINCES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Latitude{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        placeholder="-33.9249"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Longitude{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        placeholder="18.4241"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save location"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
