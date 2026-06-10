"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field, SelectInput, TextInput } from "@/app/dashboard/setup/_atoms";
import { saveListingPatchAction } from "@/app/dashboard/listings/[id]/edit/actions";
import {
  SA_PROVINCES,
  locationSchema,
  type LocationInput,
} from "@/app/dashboard/listings/[id]/edit/schemas";
import { LocationPicker } from "@/components/location/LocationPicker";

type LocationListing = {
  id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

function emptyToNull(v: string): string | null {
  return v.length > 0 ? v : null;
}
function strToNum(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Single source of truth for a listing's address + map pin. Rendered by the
// editor's Location tab AND the setup Listing card. Address + city + province
// power SEO and location search; lat/lng (optional) place the map pin.
export function ListingLocationForm({
  listing,
  submitLabel = "Save location",
  onSaved,
}: {
  listing: LocationListing;
  submitLabel?: string;
  onSaved?: (patch: Partial<LocationListing>) => void;
}) {
  const [pending, start] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LocationInput>({
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

  const watchedLat = watch("latitude");
  const watchedLng = watch("longitude");
  const latNum = watchedLat === "" ? null : Number(watchedLat);
  const lngNum = watchedLng === "" ? null : Number(watchedLng);
  const pickerLat = latNum != null && Number.isFinite(latNum) ? latNum : null;
  const pickerLng = lngNum != null && Number.isFinite(lngNum) ? lngNum : null;

  function onSubmit(values: LocationInput) {
    start(async () => {
      const patch = {
        address_line1: emptyToNull(values.address_line1),
        address_line2: emptyToNull(values.address_line2),
        city: emptyToNull(values.city),
        province: emptyToNull(values.province),
        postal_code: emptyToNull(values.postal_code),
        latitude: strToNum(values.latitude),
        longitude: strToNum(values.longitude),
      };
      const result = await saveListingPatchAction(listing.id, patch);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Location saved.");
      onSaved?.(patch);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <LocationPicker
        latitude={pickerLat}
        longitude={pickerLng}
        onSelect={(sel) => {
          setValue("latitude", String(sel.latitude), { shouldDirty: true });
          setValue("longitude", String(sel.longitude), { shouldDirty: true });
          if (sel.address_line1)
            setValue("address_line1", sel.address_line1, { shouldDirty: true });
          if (sel.city) setValue("city", sel.city, { shouldDirty: true });
          if (sel.province)
            setValue("province", sel.province, { shouldDirty: true });
          if (sel.postal_code)
            setValue("postal_code", sel.postal_code, { shouldDirty: true });
        }}
      />

      <Field
        label="Street address"
        required
        error={errors.address_line1?.message}
      >
        <TextInput
          placeholder="42 Long Street"
          {...register("address_line1")}
        />
      </Field>

      <Field
        label="Suite / unit"
        optional
        error={errors.address_line2?.message}
      >
        <TextInput {...register("address_line2")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City / town" required error={errors.city?.message}>
          <TextInput placeholder="Cape Town" {...register("city")} />
        </Field>
        <Field label="Province" required error={errors.province?.message}>
          <SelectInput {...register("province")}>
            <option value="">Pick a province</option>
            {SA_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Postal code" error={errors.postal_code?.message}>
          <TextInput {...register("postal_code")} />
        </Field>
        <Field label="Latitude" optional error={errors.latitude?.message}>
          <TextInput
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="-33.9249"
            {...register("latitude")}
          />
        </Field>
        <Field label="Longitude" optional error={errors.longitude?.message}>
          <TextInput
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="18.4241"
            {...register("longitude")}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
