"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { markProductOrderEftReceived } from "@/lib/billing/product-checkout";

// Settle a product-order EFT the admin has confirmed landed in the bank. The
// pending platform_ledger row carries provider_reference `eft_<orderId>`; we
// resolve the order's pay_token from that and run the shared settle (flip order
// + ledger to paid, activate the plan, grant credits, record any promo, notify
// the buyer). Idempotent — a second click no-ops once the order is paid.

const schema = z.object({
  // The pending ledger row's provider_reference: "eft_<orderId>".
  providerReference: z
    .string()
    .trim()
    .regex(/^eft_[0-9a-f-]{6,}$/i),
  reason: z.string().optional(),
});

export const markProductEftReceivedAction = withAdminAudit<
  z.infer<typeof schema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "payments.eft_received",
    targetType: "platform_ledger",
    getTargetId: (a) => a.providerReference,
  },
  async (args, service) => {
    const { providerReference } = schema.parse(args);
    const orderId = providerReference.slice("eft_".length);

    const { data: order } = await service
      .from("product_orders")
      .select("pay_token, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) throw new Error("No product order for this EFT reference.");

    const r = await markProductOrderEftReceived(order.pay_token);
    if (!r.ok) throw new Error(r.error);

    revalidatePath("/admin/payments");
    return { result: { ok: true }, after: { orderId, settled: true } };
  },
);

// Thin client-callable wrapper (a client component can't call the audited const).
export async function markProductEftReceived(input: {
  providerReference: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await markProductEftReceivedAction({
      providerReference: input.providerReference,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
