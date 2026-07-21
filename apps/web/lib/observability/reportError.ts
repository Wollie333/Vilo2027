import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Record a runtime error so somebody can find out about it.
 *
 * Before this, nothing reported production failures: no error boundary, no
 * Sentry, no log sink. A crash surfaced as Next's default error page and was
 * recorded nowhere, so the only signal was a customer complaining — and most
 * don't complain, they leave.
 *
 * Capture must NEVER be able to break the thing it is watching, so every path
 * here swallows its own failure. An observability tool that can throw is a new
 * outage cause wearing a helpful hat.
 */
export type ErrorSource = "server" | "client" | "worker";

/**
 * Group repeats under one row. Built from the error's identity, not its
 * incidentals — a message with an id or timestamp baked in would otherwise
 * create a new row every occurrence and bury everything else.
 */
export function fingerprintError(input: {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  route?: string | null;
}): string {
  const stripIds = (s: string) =>
    s
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "<id>",
      )
      .replace(/\b\d{4,}\b/g, "<n>");

  const normalisedMessage = stripIds(input.message).slice(0, 300);

  // The ROUTE must be normalised too, not just the message. One broken booking
  // card is one bug, whether it blew up on /booking/abc or /booking/zzz —
  // fingerprinting the raw path spawned a row per page and buried everything
  // else, which is the exact flooding this function exists to prevent.
  // A path segment is treated as an identifier when it is a uuid, all digits, or
  // simply long — which covers /booking/<uuid>, /invoice/1042 and
  // /property/table-mountain-guest-house alike. Short segments ("book", "edit")
  // are route STRUCTURE and are kept, so genuinely different pages stay apart.
  const normalisedRoute = (input.route ?? "")
    .split("?")[0]
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          seg,
        );
      if (isUuid || /^\d+$/.test(seg) || seg.length >= 12) return "<id>";
      return seg;
    })
    .join("/");

  // First stack frame is where it actually went wrong; the rest is noise for
  // grouping purposes.
  const firstFrame =
    (input.stack ?? "").split("\n").find((l) => l.includes("at ")) ?? "";
  return createHash("sha256")
    .update(
      [
        input.source,
        normalisedMessage,
        firstFrame.trim(),
        normalisedRoute,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
}

export async function reportError(input: {
  error: unknown;
  source?: ErrorSource;
  route?: string | null;
  userId?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const source = input.source ?? "server";
    const err = input.error;
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error";
    const stack = err instanceof Error ? (err.stack ?? null) : null;

    const admin = createAdminClient();
    await admin.rpc("record_error_event", {
      p_source: source,
      p_fingerprint: fingerprintError({
        source,
        message,
        stack,
        route: input.route,
      }),
      p_message: message,
      p_stack: stack,
      p_url: input.route ?? null,
      p_user_id: input.userId ?? null,
      p_context: (input.context ?? {}) as never,
    });
  } catch {
    // Deliberately silent. If reporting an error fails there is nowhere left to
    // report it to, and throwing here would turn a handled problem into a crash.
  }
}
