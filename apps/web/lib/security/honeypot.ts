import "server-only";

/**
 * Always-on honeypot — a hidden decoy field on the signup forms that real users
 * never see or fill, but form-stuffing bots typically do. Unlike Turnstile
 * (which is INERT until TURNSTILE_SECRET_KEY is configured), this needs no
 * secret and no third party, so signup is never left with zero bot protection.
 *
 * Usage:
 *   • Client: render a visually-hidden <input name={HONEYPOT_FIELD} tabIndex={-1}
 *     autoComplete="off" aria-hidden> and pass its value to the Server Action.
 *   • Server: `if (isHoneypotTripped(value)) return <benign rejection>` BEFORE
 *     creating anything. Reject quietly — never hint that the field is a trap.
 */
export const HONEYPOT_FIELD = "company_website";

/** True when the decoy field was filled → almost certainly a bot. */
export function isHoneypotTripped(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
