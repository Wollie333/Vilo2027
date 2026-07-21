import "server-only";

/**
 * The ONE place the outgoing sender address is resolved.
 *
 * It used to be resolved in four places, and they disagreed: send.ts used `||`
 * so an empty EMAIL_FROM_ADDRESS fell back to a working sender, while drain.ts,
 * broadcast.ts and the admin test-send used `??` — which treats an empty string
 * as configured and hands Resend `from: ""`, so those three rejected every
 * message while the fourth appeared fine. An env var that is *set but empty* is
 * the failure this whole module exists to make impossible.
 */

const FALLBACK = "Wielo <onboarding@resend.dev>";

/** The from-address to hand Resend. Never empty. */
export function emailFrom(): string {
  return process.env.EMAIL_FROM_ADDRESS?.trim() || FALLBACK;
}

export type EmailConfigStatus = {
  /** Resend will accept a send at all (an API key exists). */
  apiKeyPresent: boolean;
  /** A real sender is configured — not the shared sandbox one. */
  senderConfigured: boolean;
  from: string;
  /**
   * True when mail cannot reach ordinary recipients. Either there is no API key
   * (nothing is sent at all), or we are on Resend's `onboarding@resend.dev`
   * sandbox sender, which only delivers to the Resend account owner's own
   * address — every guest, host and partner is silently rejected.
   */
  deliveryBroken: boolean;
  reason: string | null;
};

/**
 * Report whether outgoing email can actually reach a customer.
 *
 * Every send path in this app is best-effort and swallows failures so a booking
 * or signup never dies because of an email — which is right, but it means a
 * misconfiguration is invisible from the outside. Nothing bounces, nothing
 * errors, the guest simply never hears from us. This is what the admin surfaces
 * so that state cannot sit unnoticed.
 */
export function emailConfigStatus(): EmailConfigStatus {
  const apiKeyPresent = !!process.env.RESEND_API_KEY?.trim();
  const from = emailFrom();
  const senderConfigured = !from.includes("resend.dev");

  let reason: string | null = null;
  if (!apiKeyPresent) {
    reason =
      "RESEND_API_KEY is not set — no email is being sent at all. Every verification link, booking confirmation and partner invitation is discarded silently.";
  } else if (!senderConfigured) {
    reason =
      "EMAIL_FROM_ADDRESS is not set, so mail goes out as onboarding@resend.dev. Resend's sandbox sender only delivers to the Resend account owner — every other recipient is rejected. Verify your domain in Resend and set EMAIL_FROM_ADDRESS.";
  }

  return {
    apiKeyPresent,
    senderConfigured,
    from,
    deliveryBroken: !apiKeyPresent || !senderConfigured,
    reason,
  };
}
