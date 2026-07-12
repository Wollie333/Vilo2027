"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { accrueAffiliateAndNotify } from "@/lib/affiliate/notify";
import { createProductOrder } from "@/lib/billing/product-checkout";

const LEDGER_TARGET = "00000000-0000-0000-0000-00000001ed6e";

const manualSchema = z.object({
  hostEmail: z.string().trim().toLowerCase().email("Enter a valid email."),
  type: z.enum(["charge", "refund", "credit", "adjustment"]),
  // Magnitude for charge/refund/credit; signed for adjustment.
  amount: z.number().refine((n) => n !== 0, "Amount can't be zero."),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  reason: z.string().min(3, "A reason is required."),
});

// Post a manual Wielo-ledger entry against a host's account (goodwill credit,
// write-off, off-platform charge, correction). Super-admin only, audited.
export const recordManualLedgerEntryAction = withAdminAudit<
  z.infer<typeof manualSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.ledger.manual_entry",
    targetType: "platform_ledger",
    getTargetId: () => LEDGER_TARGET,
    requireReason: true,
  },
  async (args, service) => {
    const parsed = manualSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { hostEmail, type, amount, currency, reason } = parsed.data;

    const { data: profile } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", hostEmail)
      .maybeSingle();
    if (!profile) throw new Error("No user found with that email.");
    const { data: host } = await service
      .from("hosts")
      .select("id")
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    // Sign the amount by type: charge in (+), refund/credit out (-),
    // adjustment as entered.
    const magnitude = Math.abs(amount);
    const signed =
      type === "charge"
        ? magnitude
        : type === "refund" || type === "credit"
          ? -magnitude
          : amount;

    const admin = await requirePermission("subscriptions.edit");

    // Inherit the platform's current Paystack mode so a manual entry posted while
    // testing shows up in the Test-filtered ledger view (instead of always being
    // 'live' via the column default and vanishing from the test scope).
    const { data: paySettings } = await service
      .from("platform_payment_settings")
      .select("paystack_mode")
      .eq("id", true)
      .maybeSingle();
    const environment = paySettings?.paystack_mode === "test" ? "test" : "live";

    // A manual REFUND auto-links to the charge it reverses — the payer's most
    // recent unreversed commissionable charge — so affiliate commission is
    // clawed back (fully, or proportionally if it's a partial refund) by the
    // clawback trigger. Goodwill credits/adjustments are NOT linked (they don't
    // reverse a sale). Null when the payer wasn't referred → no-op.
    let reversesLedgerId: string | null = null;
    if (type === "refund") {
      const { data: ref } = await service
        .from("affiliate_referrals")
        .select("id")
        .eq("referred_user_id", profile.id)
        .maybeSingle();
      if (ref) {
        const { data: comm } = await service
          .from("affiliate_commissions")
          .select("source_ledger_id")
          .eq("referral_id", ref.id)
          .eq("entry_type", "accrual")
          .in("status", ["pending", "cleared"])
          .is("refund_ledger_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        reversesLedgerId = comm?.source_ledger_id ?? null;
      }
    }

    const { data, error } = await service
      .from("platform_ledger")
      .insert({
        user_id: profile.id,
        host_id: host?.id ?? null,
        type,
        status: "completed",
        amount: signed,
        currency,
        environment,
        provider: "manual",
        reverses_ledger_id: reversesLedgerId,
        reason,
        created_by: admin.userId,
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // A manual charge against a referred user accrues affiliate commission too
    // (idempotent + no-ops for unreferred payers) and notifies the affiliate.
    if (type === "charge" && data?.id) {
      await accrueAffiliateAndNotify(service, data.id);
    }

    revalidatePath("/admin/subscriptions/revenue");
    return { result: { ok: true }, after: data };
  },
);

// Generate a Wielo payment link for a user to pay for a product (subscription).
// Reuses the product-order pay flow: creates a pending order + tokenised
// /pay/product/[token] link (Paystack + EFT), which mints the invoice + ledger
// row on payment. Super-admin only, audited.
const paymentLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  productId: z.string().uuid("Pick a product."),
  // Optional buyer details — stored on the (guest) user created for the order.
  name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  // Unused by the flow, but lets the withAdminAudit generic (TArgs extends
  // { reason?: string }) accept these args.
  reason: z.string().optional(),
});

export const createWieloPaymentLinkAction = withAdminAudit<
  z.infer<typeof paymentLinkSchema>,
  { ok: true; url: string; token: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "subscriptions.payment_link.create",
    targetType: "platform_ledger",
    getTargetId: (args) => args.email,
  },
  async (args) => {
    const parsed = paymentLinkSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const admin = await requirePermission("subscriptions.edit");
    // A payment link is SHARED with the host — it must be the canonical PUBLIC
    // URL that actually works when they click it, never a localhost/dev origin.
    // Prefer the configured app URL in production; ignore a localhost value (dev)
    // and fall back to the brand domain so a link generated locally is still real.
    const envUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
    const base =
      !envUrl || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(envUrl)
        ? "https://wielo.co.za"
        : envUrl;
    const r = await createProductOrder(
      {
        productId: parsed.data.productId,
        email: parsed.data.email,
        createdBy: admin.userId,
        name: parsed.data.name ?? null,
        phone: parsed.data.phone ?? null,
      },
      base,
    );
    if (!r.ok) throw new Error(r.error);
    return {
      result: { ok: true, url: r.url, token: r.token },
      after: { token: r.token, email: parsed.data.email },
    };
  },
);
