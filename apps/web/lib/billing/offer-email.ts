import "server-only";

import { createElement } from "react";

import { ProductOffer } from "@vilo/emails";

import { getBrandName } from "@/lib/brand";
import { sendReactEmail } from "@/lib/email/send";
import type { createAdminClient } from "@/lib/supabase/admin";

/** Money exactly as the inbox pay card renders it (lib/inbox/platform-thread
 * fmtMoney), so the emailed offer and the in-app card never disagree. */
export function fmtOfferMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Email a buyer the offer an admin just sent them — the same product + amount +
 * Pay button as the card dropped into their Wielo inbox.
 *
 * THE one place that sends it, shared by the once-off / credit-pack sale
 * (sellProductAction) and the membership upgrade (setUserProductAction), so both
 * offers look identical and can't drift.
 *
 * Best-effort: a sale must NEVER fail because an email didn't send.
 */
export async function sendProductOfferEmail(
  service: ReturnType<typeof createAdminClient>,
  input: {
    userId: string;
    email: string;
    productName: string;
    amount: number;
    currency: string;
    payUrl: string;
    note?: string | null;
  },
): Promise<void> {
  try {
    const { data: buyer } = await service
      .from("user_profiles")
      .select("full_name")
      .eq("id", input.userId)
      .maybeSingle();
    const brandName = await getBrandName();
    const money = fmtOfferMoney(input.amount, input.currency);
    await sendReactEmail({
      to: input.email,
      subject: `${input.productName} — ${money} to pay`,
      react: createElement(ProductOffer, {
        firstName: (buyer?.full_name ?? "").trim().split(/\s+/)[0] || "there",
        productName: input.productName,
        amount: money,
        payUrl: input.payUrl,
        brandName,
        note: input.note ?? null,
      }),
    });
  } catch {
    // best-effort — never fail the sale on an email
  }
}
