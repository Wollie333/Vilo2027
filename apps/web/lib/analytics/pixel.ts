// Meta Pixel standard-event helpers, following Meta's commerce-event spec.
//
// Every commerce event (ViewContent / InitiateCheckout / AddPaymentInfo /
// Purchase) sends the params Meta recommends for value optimisation + dynamic
// ads: content_type, content_ids, a `contents` array ([{id, quantity,
// item_price}]), content_name, currency, value and num_items. Each fire also
// carries an `eventID` so a future Conversions API server event dedupes against
// the browser pixel (and refresh-safe events like Purchase pass a STABLE id).
//
// `window.fbq` / `window.dataLayer` are declared globally in
// lib/analytics/purchase.ts. Every helper no-ops when fbq isn't loaded (no
// consent / no configured pixel), so callers never need to guard.

export type CommerceInput = {
  /** Catalog ids for the item(s) — keep stable across ViewContent → Purchase. */
  contentIds: string[];
  contentName?: string;
  currency: string;
  /** Total value; omitted entirely when unknown (never send value: 0). */
  value?: number;
  /** Defaults to the number of content ids. */
  numItems?: number;
};

/**
 * Build Meta's recommended commerce param bag. Adds the `contents` array (used
 * by dynamic ads + value optimisation) alongside `content_ids`. For a single
 * item the per-unit `item_price` is the value; multi-item skips item_price
 * (we don't have per-line prices here).
 */
export function commerceParams(input: CommerceInput): Record<string, unknown> {
  const numItems = input.numItems ?? Math.max(1, input.contentIds.length);
  const single = input.contentIds.length === 1;
  const contents = input.contentIds.map((id) => ({
    id,
    quantity: 1,
    ...(single && input.value != null ? { item_price: input.value } : {}),
  }));
  return {
    content_type: "product",
    content_ids: input.contentIds,
    contents,
    ...(input.contentName ? { content_name: input.contentName } : {}),
    currency: input.currency,
    ...(input.value != null ? { value: input.value } : {}),
    num_items: numItems,
  };
}

/** A one-off event id for browser↔CAPI dedup (unique per event occurrence). */
export function newEventId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}.${rand}`;
}

function pushDataLayer(event: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: `vilo_${event.toLowerCase()}`, ...params });
}

function trackFbq(
  event: string,
  params: Record<string, unknown>,
  eventID?: string,
): boolean {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return false;
  }
  window.fbq("track", event, params, eventID ? { eventID } : undefined);
  return true;
}

/**
 * Fire a standard event immediately — for INTERACTION events (e.g.
 * AddPaymentInfo on payment-method select) where the pixel is already loaded by
 * the time the user acts. Pushes the GA4/GTM dataLayer event too.
 */
export function firePixelEvent(
  event: string,
  params: Record<string, unknown>,
  eventID?: string,
): void {
  pushDataLayer(event, params);
  trackFbq(event, params, eventID);
}

/**
 * Fire a standard event, retrying the fbq call for up to ~3s — for PAGE-LOAD
 * events (ViewContent / InitiateCheckout) where the pixel script may still be
 * loading (it loads async, and on host sites only after cookie-consent). The
 * GA4/GTM dataLayer push happens once, immediately; the poll stops itself.
 */
export function firePixelEventWithRetry(
  event: string,
  params: Record<string, unknown>,
  eventID?: string,
): void {
  pushDataLayer(event, params);
  if (trackFbq(event, params, eventID)) return;
  if (typeof window === "undefined") return;
  let tries = 0;
  const iv = window.setInterval(() => {
    if (trackFbq(event, params, eventID) || (tries += 1) > 30) {
      window.clearInterval(iv);
    }
  }, 100);
}
