import "server-only";

import { cache } from "react";

import {
  DEFAULT_COMPANY_LOCATION,
  DEFAULT_COMPANY_NAME,
  getCompanyLegalName,
} from "@/lib/brand";
import type { InvoiceBusiness } from "@/lib/pdf/InvoiceDocument";
import { createAdminClient } from "@/lib/supabase/admin";

// Vilo's own business identity — the issuer on every Vilo invoice. Stored as a
// single jsonb `vilo_business` row in platform_settings (admin-managed), mirrors
// how a host's `businesses` row drives their booking invoices. The invoice
// snapshot is frozen at issue time by the mint_vilo_invoice trigger; this helper
// is for the admin form (current values) + rendering historic snapshots.

export type ViloBusinessProfile = {
  legal_name: string;
  vat_number: string;
  company_reg_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  country: string;
  email: string;
  logo_path: string;
};

const EMPTY: ViloBusinessProfile = {
  legal_name: "",
  vat_number: "",
  company_reg_number: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postal_code: "",
  country: "",
  email: "",
  logo_path: "",
};

// Read the saved Vilo business details (admin form values). Missing keys fall
// back to empty strings; the legal name falls back to the registered company
// name so invoices always show an issuer.
export const getViloBusinessProfile = cache(
  async (): Promise<ViloBusinessProfile> => {
    let raw: Partial<ViloBusinessProfile> = {};
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", "vilo_business")
        .maybeSingle();
      if (data?.value && typeof data.value === "object") {
        raw = data.value as Partial<ViloBusinessProfile>;
      }
    } catch {
      /* fall back to empty + brand defaults below */
    }
    const profile = { ...EMPTY, ...raw };
    if (!profile.legal_name.trim()) {
      profile.legal_name = await getCompanyLegalName();
    }
    return profile;
  },
);

// Turn a frozen vilo_snapshot (or the live profile) into the issuer party shown
// on the FinancialDocument: a name + address/identity lines.
export function viloIssuerLines(snap: Partial<ViloBusinessProfile>): {
  name: string;
  lines: string[];
} {
  const name = snap.legal_name?.trim() || DEFAULT_COMPANY_NAME;
  const lines = [
    snap.address_line1,
    snap.address_line2,
    [snap.city, snap.postal_code].filter((s) => s && s.trim()).join(" "),
    snap.country && snap.country.trim() && snap.country.trim() !== "ZA"
      ? snap.country
      : null,
    snap.vat_number?.trim() ? `VAT ${snap.vat_number.trim()}` : null,
    snap.company_reg_number?.trim()
      ? `Reg ${snap.company_reg_number.trim()}`
      : null,
    snap.email?.trim() || null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  if (lines.length === 0) lines.push(DEFAULT_COMPANY_LOCATION);
  return { name, lines };
}

// Map a frozen vilo_snapshot to the PDF InvoiceBusiness shape (issuer block).
export function viloSnapshotToBusiness(
  snap: Partial<ViloBusinessProfile>,
): InvoiceBusiness {
  const address = [
    snap.address_line1,
    snap.address_line2,
    [snap.city, snap.postal_code].filter((s) => s && s.trim()).join(" "),
    snap.country && snap.country.trim() !== "ZA" ? snap.country : null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  return {
    legalName: snap.legal_name ?? null,
    tradingName: null,
    vatNumber: snap.vat_number ?? null,
    companyRegistrationNumber: snap.company_reg_number ?? null,
    billingAddress: address.length > 0 ? address : null,
  };
}
