import "server-only";

import { getWieloBusinessProfile, wieloIssuerLines } from "./wielo-invoice";
import type { DocTone } from "@/components/finance/FinancialDocument";
import { createAdminClient } from "@/lib/supabase/admin";

// The affiliate commission statement / payout remittance advice — data behind
// the /wielo-commission/[id] hosted page + PDF. Issued BY Wielo TO an affiliate.
// The `[id]` is a commission uuid, or `payout_<uuid>` for a payout remittance.

export type CommissionStatement = {
  /** Document title, e.g. "Commission statement" / "Remittance advice". */
  docKind: string;
  number: string;
  dateIso: string | null;
  statusLabel: string;
  statusTone: DocTone;
  issuer: { name: string; lines: string[] };
  affiliateName: string | null;
  affiliateEmail: string | null;
  lines: { label: string; amount: number }[];
  total: number;
  totalLabel: string;
  currency: string;
  footerNote: string | null;
};

async function affiliateParty(
  admin: ReturnType<typeof createAdminClient>,
  affiliateId: string | null,
): Promise<{ name: string | null; email: string | null }> {
  if (!affiliateId) return { name: null, email: null };
  const { data } = await admin
    .from("affiliate_accounts")
    .select("user:user_profiles!user_id ( full_name, email )")
    .eq("id", affiliateId)
    .maybeSingle();
  const u = data ? (Array.isArray(data.user) ? data.user[0] : data.user) : null;
  return { name: u?.full_name ?? null, email: u?.email ?? null };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function loadCommissionStatement(
  id: string,
): Promise<CommissionStatement | null> {
  const admin = createAdminClient();
  const issuer = wieloIssuerLines(await getWieloBusinessProfile());

  // Monthly period statement: id = `period_<affiliateId>_<YYYY-MM>` — aggregates
  // every (non-voided) commission the affiliate earned that month into one doc.
  if (id.startsWith("period_")) {
    const rest = id.slice("period_".length);
    const us = rest.lastIndexOf("_");
    if (us < 0) return null;
    const affiliateId = rest.slice(0, us);
    const period = rest.slice(us + 1); // YYYY-MM
    const [y, m] = period.split("-").map(Number);
    if (!y || !m || m < 1 || m > 12) return null;
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();

    const { data: comms } = await admin
      .from("affiliate_commissions")
      .select(
        "commission_amount, currency, status, product_id, entry_type, created_at",
      )
      .eq("affiliate_id", affiliateId)
      .neq("status", "voided")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });
    const rows = comms ?? [];
    const party = await affiliateParty(admin, affiliateId);

    const productIds = [
      ...new Set(rows.map((c) => c.product_id).filter(Boolean)),
    ] as string[];
    const productName = new Map<string, string>();
    if (productIds.length) {
      const { data: prods } = await admin
        .from("products")
        .select("id, name")
        .in("id", productIds);
      for (const p of prods ?? []) productName.set(p.id, p.name);
    }

    const lines = rows.map((c) => {
      const base = c.product_id
        ? (productName.get(c.product_id) ?? "referral")
        : "referral";
      const reversal =
        c.entry_type === "clawback" || Number(c.commission_amount) < 0;
      return {
        label: `${reversal ? "Reversal · " : "Commission · "}${base}`,
        amount: Number(c.commission_amount),
      };
    });
    const total = rows.reduce((s, c) => s + Number(c.commission_amount), 0);
    const currency = rows[0]?.currency ?? "ZAR";

    return {
      docKind: "Monthly commission statement",
      number: `STMT-${period}`,
      dateIso: end,
      statusLabel: `${MONTHS[m - 1]} ${y}`,
      statusTone: "indigo",
      issuer,
      affiliateName: party.name,
      affiliateEmail: party.email,
      lines:
        lines.length > 0
          ? lines
          : [{ label: "No commission this month", amount: 0 }],
      total: Math.round(total * 100) / 100,
      totalLabel: "Total earned",
      currency,
      footerNote: `Affiliate commission earned in ${MONTHS[m - 1]} ${y}, per the affiliate terms.`,
    };
  }

  if (id.startsWith("payout_")) {
    const payoutId = id.slice("payout_".length);
    const { data: p } = await admin
      .from("affiliate_payouts")
      .select(
        "id, affiliate_id, gross_amount, fee_amount, net_amount, currency, status, method, provider_reference, created_at, processed_at",
      )
      .eq("id", payoutId)
      .maybeSingle();
    if (!p) return null;
    const party = await affiliateParty(admin, p.affiliate_id);
    const gross = Number(p.gross_amount ?? p.net_amount);
    const fee = Number(p.fee_amount ?? 0);
    const paid = p.status === "paid" || p.status === "completed";
    return {
      docKind: "Remittance advice",
      number: `RMT-${p.id.slice(0, 8).toUpperCase()}`,
      dateIso: p.processed_at ?? p.created_at,
      statusLabel: paid ? "Paid" : p.status === "failed" ? "Failed" : "Pending",
      statusTone: paid ? "green" : p.status === "failed" ? "red" : "amber",
      issuer,
      affiliateName: party.name,
      affiliateEmail: party.email,
      lines: [
        { label: "Commission payout", amount: gross },
        ...(fee > 0.005 ? [{ label: "Payout fee", amount: -fee }] : []),
      ],
      total: Number(p.net_amount),
      totalLabel: "Net paid",
      currency: p.currency ?? "ZAR",
      footerNote: p.method ? `Paid via ${p.method}.` : null,
    };
  }

  const { data: c } = await admin
    .from("affiliate_commissions")
    .select(
      "id, affiliate_id, commission_amount, currency, status, product_id, referred_host_id, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const party = await affiliateParty(admin, c.affiliate_id);
  let productLabel = "referral";
  if (c.product_id) {
    const { data: prod } = await admin
      .from("products")
      .select("name")
      .eq("id", c.product_id)
      .maybeSingle();
    if (prod?.name) productLabel = prod.name;
  }
  const paid = c.status === "paid";
  return {
    docKind: "Commission statement",
    number: `COM-${c.id.slice(0, 8).toUpperCase()}`,
    dateIso: c.created_at,
    statusLabel: paid ? "Paid" : c.status === "cleared" ? "Cleared" : "Pending",
    statusTone: paid ? "green" : c.status === "cleared" ? "indigo" : "amber",
    issuer,
    affiliateName: party.name,
    affiliateEmail: party.email,
    lines: [
      {
        label: `Affiliate commission · ${productLabel}`,
        amount: Number(c.commission_amount),
      },
    ],
    total: Number(c.commission_amount),
    totalLabel: "Commission owed",
    currency: c.currency ?? "ZAR",
    footerNote:
      "Commission earned on a referred purchase, payable per the affiliate terms.",
  };
}
