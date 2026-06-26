"use client";

import { useEffect } from "react";

import { firePurchase, type PurchaseEvent } from "@/lib/analytics/purchase";

/**
 * Fires the GA4/GTM `purchase` + Meta Pixel `Purchase` event (with the booking's
 * real value + currency) once, on the on-site booking thank-you. De-dupe + the
 * data-layer shape live in lib/analytics/purchase.ts. Renders nothing; `null`
 * purchase (unconfirmed / pending) is a no-op.
 */
export function FirePurchase({ purchase }: { purchase: PurchaseEvent | null }) {
  useEffect(() => {
    firePurchase(purchase);
  }, [purchase]);
  return null;
}
