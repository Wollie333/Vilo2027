import "server-only";

import { cache } from "react";

import {
  DEFAULT_COMPANY_LOCATION,
  DEFAULT_COMPANY_NAME,
  getCompanyLegalName,
} from "@/lib/brand";
import type { InvoiceBusiness } from "@/lib/pdf/InvoiceDocument";
import { createAdminClient } from "@/lib/supabase/admin";

// Wielo's own business identity — the issuer on every Wielo invoice. Stored as a
// single jsonb `wielo_business` row in platform_settings (admin-managed), mirrors
// how a host's `businesses` row drives their booking invoices. The invoice
// snapshot is frozen at issue time by the mint_wielo_invoice trigger; this helper
// is for the admin form (current values) + rendering historic snapshots.

export type WieloBusinessProfile = {
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

const EMPTY: WieloBusinessProfile = {
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

// Read the saved Wielo business details (admin form values). Missing keys fall
// back to empty strings; the legal name falls back to the registered company
// name so invoices always show an issuer.
export const getWieloBusinessProfile = cache(
  async (): Promise<WieloBusinessProfile> => {
    let raw: Partial<WieloBusinessProfile> = {};
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", "wielo_business")
        .maybeSingle();
      if (data?.value && typeof data.value === "object") {
        raw = data.value as Partial<WieloBusinessProfile>;
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

export type InvoiceBankingBlock = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
  branchCode: string;
  swiftCode: string | null;
  reference: string | null;
};

// Wielo's own bank account (platform_payment_settings EFT fields), rendered as
// "Payment details" on UNPAID Wielo invoices so a host paying by EFT knows where
// to send it. Returns null when EFT isn't enabled or no bank name is set. The
// reference defaults to the invoice number when no hint is configured. Read live
// (not frozen) — you always want to pay the CURRENT account.
export async function getPlatformInvoiceBanking(
  referenceFallback?: string | null,
): Promise<InvoiceBankingBlock | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_payment_settings")
      .select(
        "eft_enabled, eft_bank_name, eft_account_name, eft_account_number, eft_branch_code, eft_swift_code, eft_reference_hint",
      )
      .eq("id", true)
      .maybeSingle();
    if (!data?.eft_enabled || !data.eft_bank_name?.trim()) return null;
    return {
      bankName: data.eft_bank_name.trim(),
      accountHolder: data.eft_account_name?.trim() ?? "",
      accountNumber: data.eft_account_number?.trim() ?? "",
      accountType: "",
      branchCode: data.eft_branch_code?.trim() ?? "",
      swiftCode: data.eft_swift_code?.trim() || null,
      reference: data.eft_reference_hint?.trim() || referenceFallback || null,
    };
  } catch {
    return null;
  }
}

// Turn a frozen wielo_snapshot (or the live profile) into the issuer party shown
// on the FinancialDocument: a name + address/identity lines.
export function wieloIssuerLines(snap: Partial<WieloBusinessProfile>): {
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
    snap.email?.trim() || null,
    // Company identifiers always sit at the bottom of the FROM block.
    snap.company_reg_number?.trim()
      ? `Reg ${snap.company_reg_number.trim()}`
      : null,
    snap.vat_number?.trim() ? `VAT ${snap.vat_number.trim()}` : null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  if (lines.length === 0) lines.push(DEFAULT_COMPANY_LOCATION);
  return { name, lines };
}

// The three non-charge Wielo document kinds, and how each is titled/toned across
// the hosted page, the PDF and the ledger's Document column. `positive` flips a
// document that ADDS money (an upward adjustment) to a "+" in ink; everything
// else reads as money out ("−", red/indigo). Kept here so the page, the PDF and
// the ledger stay in lockstep.
export type WieloCreditNoteKind = "refund" | "credit" | "adjustment";

export function wieloCreditNoteLabels(
  kind: WieloCreditNoteKind,
  signedAmount: number,
): {
  docKind: string; // document title
  toLabel: string; // party heading
  totalLabel: string; // grand-total row
  statusTone: "red" | "indigo" | "amber"; // hosted-page status pill
  positive: boolean; // upward money movement
} {
  if (kind === "refund") {
    return {
      docKind: "Refund",
      toLabel: "Refunded to",
      totalLabel: "Total refunded",
      statusTone: "red",
      positive: false,
    };
  }
  if (kind === "credit") {
    return {
      docKind: "Credit note",
      toLabel: "Credited to",
      totalLabel: "Total credited",
      statusTone: "indigo",
      positive: false,
    };
  }
  // adjustment — signed: a positive one adds to the account, a negative one
  // reduces it.
  const up = signedAmount >= 0;
  return {
    docKind: "Adjustment",
    toLabel: "Account holder",
    totalLabel: "Total adjustment",
    statusTone: "amber",
    positive: up,
  };
}

// Map a frozen wielo_snapshot to the PDF InvoiceBusiness shape (issuer block).
export function wieloSnapshotToBusiness(
  snap: Partial<WieloBusinessProfile>,
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
