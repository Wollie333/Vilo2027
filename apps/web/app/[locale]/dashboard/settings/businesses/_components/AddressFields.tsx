"use client";

import { useTranslations } from "next-intl";

import { Field, TextInput } from "@/app/[locale]/dashboard/setup/_atoms";
import {
  LocationPicker,
  type LocationSelection,
} from "@/components/location/LocationPicker";

export type AddressValue = {
  address_line1: string;
  address_line2: string;
  city: string;
  municipality: string;
  province: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export const EMPTY_ADDRESS: AddressValue = {
  address_line1: "",
  address_line2: "",
  city: "",
  municipality: "",
  province: "",
  postal_code: "",
  country: "ZA",
  latitude: null,
  longitude: null,
};

// Shared address block: the keyless LocationPicker (search + map) wired to the
// same field set used by the listing editor, plus editable text inputs. Parent
// owns the value; we emit a partial patch on every change.
export function AddressFields({
  value,
  onChange,
}: {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
}) {
  const t = useTranslations("businesses");

  function handleSelect(s: LocationSelection) {
    // Only overwrite a field when the geocoder actually returned it — lat/lng
    // are always present; the rest are best-effort.
    const patch: Partial<AddressValue> = {
      latitude: s.latitude,
      longitude: s.longitude,
    };
    if (s.address_line1) patch.address_line1 = s.address_line1;
    if (s.city) patch.city = s.city;
    if (s.municipality) patch.municipality = s.municipality;
    if (s.province) patch.province = s.province;
    if (s.postal_code) patch.postal_code = s.postal_code;
    onChange(patch);
  }

  return (
    <div className="space-y-4">
      <LocationPicker
        latitude={value.latitude}
        longitude={value.longitude}
        onSelect={handleSelect}
      />

      <Field label={t("addrLine1")} optional>
        <TextInput
          value={value.address_line1}
          onChange={(e) => onChange({ address_line1: e.target.value })}
          placeholder="42 Long Street"
        />
      </Field>
      <Field label={t("addrLine2")} optional>
        <TextInput
          value={value.address_line2}
          onChange={(e) => onChange({ address_line2: e.target.value })}
          placeholder="Suite 4B"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("addrCity")} optional>
          <TextInput
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Cape Town"
          />
        </Field>
        <Field label={t("addrProvince")} optional>
          <TextInput
            value={value.province}
            onChange={(e) => onChange({ province: e.target.value })}
            placeholder="Western Cape"
          />
        </Field>
      </div>

      <Field label={t("addrMunicipality")} optional>
        <TextInput
          value={value.municipality}
          onChange={(e) => onChange({ municipality: e.target.value })}
          placeholder="Thaba Chweu Local Municipality"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("addrPostal")} optional>
          <TextInput
            value={value.postal_code}
            onChange={(e) => onChange({ postal_code: e.target.value })}
            placeholder="8001"
          />
        </Field>
        <Field label={t("addrCountry")} hint="ISO 2-letter code.">
          <TextInput
            maxLength={2}
            value={value.country}
            onChange={(e) =>
              onChange({ country: e.target.value.toUpperCase() })
            }
            placeholder="ZA"
          />
        </Field>
      </div>
    </div>
  );
}
