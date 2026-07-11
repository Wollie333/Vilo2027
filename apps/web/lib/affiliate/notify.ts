import "server-only";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { formatMoney } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

// Accrue affiliate commission for a settled charge AND notify the affiliate when
// a commission is actually created. One call for every TS settle path. Never
// throws into settlement.
export async function accrueAffiliateAndNotify(
  admin: Db,
  ledgerId: string,
): Promise<void> {
  try {
    const { data: commissionId } = await admin.rpc(
      "accrue_affiliate_commission",
      { p_ledger_id: ledgerId },
    );
    if (!commissionId || typeof commissionId !== "string") return;

    const { data: c } = await admin
      .from("affiliate_commissions")
      .select("commission_amount, currency, affiliate_id, product_id")
      .eq("id", commissionId)
      .maybeSingle();
    if (!c) return;

    const [{ data: acct }, prod] = await Promise.all([
      admin
        .from("affiliate_accounts")
        .select("user_id, user:user_profiles!user_id ( email )")
        .eq("id", c.affiliate_id)
        .maybeSingle(),
      c.product_id
        ? admin
            .from("products")
            .select("name")
            .eq("id", c.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
    ]);
    if (!acct?.user_id) return;
    const acctUser = Array.isArray(acct.user) ? acct.user[0] : acct.user;

    await dispatchEvent({
      kind: "affiliate_commission_earned",
      recipientUserId: acct.user_id,
      refs: {
        amount: formatMoney(Number(c.commission_amount), c.currency ?? "ZAR"),
        detail: prod.data?.name ?? undefined,
        recipient_email: acctUser?.email ?? undefined,
      },
      supabase: admin,
    });
  } catch {
    // Accrual + notification must never break settlement.
  }
}

// Notify an affiliate that their payout has been sent (call after settle → paid).
export async function notifyAffiliatePayoutPaid(
  admin: Db,
  payoutId: string,
): Promise<void> {
  try {
    const { data: p } = await admin
      .from("affiliate_payouts")
      .select("net_amount, currency, method, affiliate_id")
      .eq("id", payoutId)
      .maybeSingle();
    if (!p) return;
    const { data: acct } = await admin
      .from("affiliate_accounts")
      .select("user_id, user:user_profiles!user_id ( email )")
      .eq("id", p.affiliate_id)
      .maybeSingle();
    if (!acct?.user_id) return;
    const acctUser = Array.isArray(acct.user) ? acct.user[0] : acct.user;

    await dispatchEvent({
      kind: "affiliate_payout_paid",
      recipientUserId: acct.user_id,
      refs: {
        amount: formatMoney(Number(p.net_amount), p.currency ?? "ZAR"),
        detail: p.method ?? undefined,
        recipient_email: acctUser?.email ?? undefined,
      },
      supabase: admin,
    });
  } catch {
    // Notification must never break the payout settlement.
  }
}
