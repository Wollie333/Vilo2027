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
export async function getHostWebsiteCapi(
  websiteId: string,
): Promise<{
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

/**
 * Send a server-side Purchase to Meta's Conversions API. Returns true only when
 * Meta accepts the event (2xx). No-ops (returns false) when CAPI isn't
 * configured/enabled. Callers gate the "already sent" marker on the return so a
 * transient failure retries on the next page load.
 */
export type CapiCreds = {
  pixelId: string;
  token: string;
  testEventCode: string | null;
};

export async function sendCapiPurchase(
  input: CapiPurchaseInput,
  // Explicit credentials (per-host website CAPI). Omit to use the WIELO platform
  // config from platform_integrations (directory bookings).
  creds?: CapiCreds,
): Promise<boolean> {
  const cfg = creds ?? (await getCapiConfig());
  if (!cfg) return false;

  const userData: Record<string, unknown> = {};
  const em = hashEmail(input.email);
  if (em) userData.em = [em];
  const ph = hashPhone(input.phone);
  if (ph) userData.ph = [ph];
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: {
          currency: input.currency,
          value: input.value,
          content_type: "product",
          content_ids: input.contentIds,
          contents: input.contents,
          num_items: input.numItems,
        },
      },
    ],
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
    return res.ok;
  } catch {
    return false;
  }
}
