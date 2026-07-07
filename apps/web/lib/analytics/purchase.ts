// Shared client-side purchase tracking. Pushes a single GA4/GTM `purchase`
// event onto window.dataLayer AND fires the Meta Pixel `Purchase` event with the
// correct dynamic value/currency. De-duped per transaction via sessionStorage so
// a refresh doesn't double-count. A stable `eventID` (the transaction reference)
// is passed to fbq so a future Conversions API server event dedupes against the
// browser pixel.

export type PurchaseEvent = {
  transactionId: string;
  value: number;
  currency: string;
  contentName: string;
  contentIds: string[];
  numItems: number;
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
  }>;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: (...args: unknown[]) => void;
  }
}

export function firePurchase(purchase: PurchaseEvent | null | undefined): void {
  if (!purchase || typeof window === "undefined") return;

  const guardKey = `vilo_purchase_pushed_${purchase.transactionId}`;
  try {
    if (window.sessionStorage.getItem(guardKey)) return; // de-dupe on refresh
    window.sessionStorage.setItem(guardKey, "1");
  } catch {
    /* sessionStorage may be unavailable (private mode) — fire anyway */
  }

  // GA4 / GTM ecommerce shape.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null }); // clear stale items
  window.dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: purchase.transactionId,
      value: purchase.value,
      currency: purchase.currency,
      items: purchase.items,
    },
    meta_purchase: {
      currency: purchase.currency,
      value: purchase.value,
      content_type: "product",
      content_name: purchase.contentName,
      content_ids: purchase.contentIds,
      num_items: purchase.numItems,
      order_id: purchase.transactionId,
    },
  });

  // Meta Pixel — fires only when the admin-configured pixel is loaded. Sends the
  // `contents` array (per-line id/quantity/price) Meta uses for dynamic ads +
  // value optimisation, alongside content_ids. eventID = the transaction ref so
  // a refresh (or a future CAPI server event) dedupes.
  if (typeof window.fbq === "function") {
    window.fbq(
      "track",
      "Purchase",
      {
        value: purchase.value,
        currency: purchase.currency,
        content_type: "product",
        content_name: purchase.contentName,
        content_ids: purchase.contentIds,
        contents: purchase.items.map((i) => ({
          id: i.item_id,
          quantity: i.quantity,
          item_price: i.price,
        })),
        num_items: purchase.numItems,
      },
      { eventID: purchase.transactionId },
    );
  }
}
