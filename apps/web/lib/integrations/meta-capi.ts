import "server-only";

import { createHash } from "node:crypto";

import { decryptSecret } from "@/lib/crypto/payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Meta Conversions API (server-side events). Fires alongside the browser Pixel
// with a matching `event_id` so Meta dedupes the pair — improving match quality
// + surviving ad-blockers. The access token is read ONLY here (server-only) and
// never leaves the server. Best-effort: every failure returns false, never
// throws, so a booking never breaks because Meta is down.

const GRAPH_VERSION = "v21.0";

// Meta requires SHA-256 of the normalised (trimmed, lowercased) value.
function hashEmail(v?: string | null): string | undefined {
  const norm = (v ?? "").trim().toLowerCase();
  if (!norm) return undefined;
  return createHash("sha256").update(norm).digest("hex");
}

// Phone: strip everything but digits (keep country code) before hashing.
function hashPhone(v?: string | null): string | undefined {
  const digits = (v ?? "").replace(/[^\d]/g, "");
  if (!digits) return undefined;
  return createHash("sha256").update(digits).digest("hex");
}

// Names + external_id: SHA-256 of the trimmed, lowercased value.
function hashNorm(v?: string | null): string | undefined {
  const norm = (v ?? "").trim().toLowerCase();
  if (!norm) return undefined;
  return createHash("sha256").update(norm).digest("hex");
}

type CapiConfig = {
  pixelId: string;
  token: string;
  testEventCode: string | null;
} | null;

async function getCapiConfig(): Promise<CapiConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_integrations")
      .select(
        "meta_pixel_id, meta_capi_access_token, meta_capi_enabled, meta_test_event_code",
      )
      .eq("id", true)
      .maybeSingle();
    if (
      !data ||
      !data.meta_capi_enabled ||
      !data.meta_pixel_id ||
      !data.meta_capi_access_token
    ) {
      return null;
    }
    return {
      pixelId: data.meta_pixel_id,
      // Stored encrypted (app-layer) by the admin action; round-trips plaintext
      // transparently when PAYMENT_CIPHER_KEY is unset.
      token: decryptSecret(data.meta_capi_access_token),
      testEventCode: data.meta_test_event_code ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve a HOST website's own CAPI credentials (server-only). The browser pixel
 * id is public (settings.analytics.metaPixel); the token is the encrypted,
 * server-only column. Returns null unless CAPI is enabled AND a token + pixel id
 * are set. Never exposes the token to the client.
 */
export async function getHostWebsiteCapi(websiteId: string): Promise<{
  pixelId: string;
  token: string;
  testEventCode: string | null;
} | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("host_websites")
      .select("settings, meta_capi_access_token, meta_capi_enabled")
      .eq("id", websiteId)
      .maybeSingle();
    if (!data || !data.meta_capi_enabled || !data.meta_capi_access_token) {
      return null;
    }
    const pixelId = (
      (data.settings as { analytics?: { metaPixel?: string } } | null)
        ?.analytics?.metaPixel ?? ""
    ).trim();
    if (!pixelId) return null;
    return {
      pixelId,
      token: decryptSecret(data.meta_capi_access_token),
      testEventCode: null,
    };
  } catch {
    return null;
  }
}

export type CapiPurchaseInput = {
  /** MUST equal the browser Pixel's event id (booking.reference) so Meta dedupes. */
  eventId: string;
  eventSourceUrl: string;
  email?: string | null;
  phone?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  /** Meta browser cookies — big match-quality boost when present. */
  fbp?: string | null;
  fbc?: string | null;
  value: number;
  currency: string;
  contentIds: string[];
  contents: { id: string; quantity: number; item_price: number }[];
  numItems: number;
};

export type CapiCreds = {
  pixelId: string;
  token: string;
  testEventCode: string | null;
};

// A single server-side Meta event. `action_source` defaults to
// "system_generated" — correct for CRM/settle-driven events that have no browser
// (a pipeline conversion, a subscription charge). Booking Purchases pass
// "website" (they DO have fbp/fbc + a page URL). Every string field is hashed
// here; callers pass plaintext.
export type CapiEventInput = {
  /** Meta standard or custom event name (Subscribe, Purchase, Lead, StartTrial…). */
  eventName: string;
  /** Stable dedup + idempotency key. */
  eventId: string;
  eventSourceUrl?: string | null;
  actionSource?: "website" | "system_generated";
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Opaque stable id (we use user_profiles.id) — hashed before sending. */
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  value?: number | null;
  currency?: string | null;
  contentIds?: string[];
  contents?: { id: string; quantity: number; item_price: number }[];
  numItems?: number;
  contentName?: string | null;
  /** POPIA/consent: send with Meta Limited Data Use flags (no PII match). */
  limitedDataUse?: boolean;
};

export type CapiSendResult = {
  /** Meta accepted the event (2xx). */
  ok: boolean;
  /** CAPI creds present + enabled. When false, the caller should NOT retry. */
  configured: boolean;
  status?: number;
  error?: string;
};

/**
 * Send ONE server-side event to Meta's Conversions API. Best-effort: never
 * throws. Returns { configured:false } when CAPI isn't set up/enabled (so a
 * queue drain can mark the row 'skipped' rather than retry forever), and
 * { configured:true, ok:false } on a transient failure (retry).
 */
export async function sendCapiEvent(
  input: CapiEventInput,
  // Explicit creds (per-host website CAPI). Omit for the WIELO platform config.
  creds?: CapiCreds,
): Promise<CapiSendResult> {
  const cfg = creds ?? (await getCapiConfig());
  if (!cfg) return { ok: false, configured: false };

  const userData: Record<string, unknown> = {};
  if (!input.limitedDataUse) {
    const em = hashEmail(input.email);
    if (em) userData.em = [em];
    const ph = hashPhone(input.phone);
    if (ph) userData.ph = [ph];
    const fn = hashNorm(input.firstName);
    if (fn) userData.fn = [fn];
    const ln = hashNorm(input.lastName);
    if (ln) userData.ln = [ln];
    const ext = hashNorm(input.externalId);
    if (ext) userData.external_id = [ext];
    if (input.clientIp) userData.client_ip_address = input.clientIp;
    if (input.userAgent) userData.client_user_agent = input.userAgent;
    if (input.fbp) userData.fbp = input.fbp;
    if (input.fbc) userData.fbc = input.fbc;
  }

  const customData: Record<string, unknown> = {};
  if (input.value != null) customData.value = input.value;
  if (input.currency) customData.currency = input.currency;
  if (input.contentIds?.length) {
    customData.content_type = "product";
    customData.content_ids = input.contentIds;
    if (input.contents) customData.contents = input.contents;
    if (input.numItems != null) customData.num_items = input.numItems;
  }
  if (input.contentName) customData.content_name = input.contentName;

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: input.actionSource ?? "system_generated",
    user_data: userData,
    custom_data: customData,
  };
  if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;
  if (input.limitedDataUse) {
    // LDU with 0/0 lets Meta infer jurisdiction and process in limited mode.
    event.data_processing_options = ["LDU"];
    event.data_processing_options_country = 0;
    event.data_processing_options_state = 0;
  }

  const body = {
    data: [event],
    ...(cfg.testEventCode ? { test_event_code: cfg.testEventCode } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(cfg.pixelId)}/events?access_token=${encodeURIComponent(cfg.token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    return { ok: res.ok, configured: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send a server-side Purchase to Meta's Conversions API (booking thank-you
 * pages). Thin wrapper over sendCapiEvent that preserves the original boolean
 * contract + "website" action_source. Callers gate the "already sent" marker on
 * the return so a transient failure retries on the next page load.
 */
export async function sendCapiPurchase(
  input: CapiPurchaseInput,
  creds?: CapiCreds,
): Promise<boolean> {
  const r = await sendCapiEvent(
    {
      eventName: "Purchase",
      eventId: input.eventId,
      eventSourceUrl: input.eventSourceUrl,
      actionSource: "website",
      email: input.email,
      phone: input.phone,
      clientIp: input.clientIp,
      userAgent: input.userAgent,
      fbp: input.fbp,
      fbc: input.fbc,
      value: input.value,
      currency: input.currency,
      contentIds: input.contentIds,
      contents: input.contents,
      numItems: input.numItems,
    },
    creds,
  );
  return r.ok;
}
