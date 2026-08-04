import "server-only";

import { getPlacedDocument } from "@/lib/legalDocuments";
import { createAdminClient } from "@/lib/supabase/admin";

// Single source of truth for the immutable, per-booking legal record — the exact
// documents a guest agreed to when they placed a booking:
//   • the Wielo platform Terms of Service + Privacy Policy accepted at checkout
//     (bookings.accepted_terms_version / accepted_privacy_version), and
//   • each host policy snapshot frozen onto the booking (policy_snapshots).
// Consumed by BOTH the admin user record (platform ↔ user view) and the host
// guest record (host ↔ guest view), so the two surfaces can never drift.

type AdminClient = ReturnType<typeof createAdminClient>;

/** One signed/frozen document, shaped to the LegalSnapshotViewer client props. */
export type LegalDoc = {
  id: string;
  kind: string;
  title: string;
  version: string;
  /** ISO timestamp, or "" for booking-scoped docs (the booking carries the date). */
  acceptedAt: string;
  ip: string | null;
  signatory: string | null;
  sha256: string | null;
  bodyHtml: string;
  context: string | null;
};

/** A booking's documents, batched under the booking reference. */
export type BookingLegalGroup = {
  bookingId: string;
  reference: string;
  date: string;
  role: "guest" | "host";
  /** The other party — the host/listing (guest view) or the guest (host view). */
  counterparty: string | null;
  docs: LegalDoc[];
};

/** The minimal booking facts the assembler needs (versions come from the booking row). */
export type BookingLegalInput = {
  id: string;
  reference: string;
  /** ISO date to show + sort by (booking created_at). */
  date: string;
  role: "guest" | "host";
  counterparty: string | null;
  termsVersion: number | null;
  privacyVersion: number | null;
};

/** Render an immutable policy_snapshots.snapshot_data jsonb into readable HTML
 *  (the exact host policy a guest agreed to for a booking). Defensive — unknown
 *  shapes fall back to name + summary. */
export function renderPolicySnapshot(data: Record<string, unknown>): string {
  if (!data || typeof data !== "object")
    return "<p><em>No policy text stored.</em></p>";
  const esc = (s: unknown) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const name = esc(data.name);
  const summary = data.summary ? `<p>${esc(data.summary)}</p>` : "";
  const type = String(data.type ?? "");
  let detail = "";
  if (type === "cancellation" && Array.isArray(data.rules)) {
    const rows = (data.rules as Record<string, unknown>[])
      .map(
        (r) =>
          `<li><strong>${esc(r.label)}</strong> — ${esc(r.refund_percent)}% refund if cancelled ${
            Number(r.days_before) > 0
              ? `${esc(r.days_before)}+ days before check-in`
              : "on or after check-in"
          }.</li>`,
      )
      .join("");
    detail = `<h3>Refund schedule</h3><ul>${rows}</ul>`;
    if (data.is_non_refundable)
      detail += `<p><strong>Non-refundable.</strong></p>`;
  } else if (type === "check_in_out") {
    const bits: string[] = [];
    if (data.check_in_time)
      bits.push(`Check-in from ${esc(data.check_in_time)}`);
    if (data.check_out_time)
      bits.push(`Check-out by ${esc(data.check_out_time)}`);
    if (data.smoking_allowed != null)
      bits.push(`Smoking ${data.smoking_allowed ? "allowed" : "not allowed"}`);
    if (data.pets_allowed != null)
      bits.push(`Pets ${data.pets_allowed ? "allowed" : "not allowed"}`);
    if (data.parties_allowed != null)
      bits.push(`Parties ${data.parties_allowed ? "allowed" : "not allowed"}`);
    detail = bits.length
      ? `<ul>${bits.map((b) => `<li>${b}</li>`).join("")}</ul>`
      : "";
  } else if (data.content && typeof data.content === "object") {
    const c = data.content as Record<string, unknown>;
    if (typeof c.html === "string") detail = c.html;
    else if (typeof c.text === "string") detail = `<p>${esc(c.text)}</p>`;
  }
  return `<h2>${name}</h2>${summary}${detail}`;
}

/** Build a platform-consent doc (Terms / Privacy) for one booking. The body is
 *  the currently-published placed document; if that slot is empty we keep an
 *  honest note rather than inventing text. */
function platformDoc(
  title: string,
  version: number,
  doc: { bodyHtml: string | null } | null,
  reference: string,
  idKey: string,
): LegalDoc {
  return {
    id: `platform-${idKey}`,
    kind: "Platform consent",
    title,
    version: `v${version}`,
    acceptedAt: "",
    ip: null,
    signatory: null,
    sha256: null,
    bodyHtml:
      doc?.bodyHtml ??
      `<p><em>Accepted at checkout (${reference}). The published text for this version is not on file — publish the ${title} in Legal docs to display it here.</em></p>`,
    context: null,
  };
}

/** Assemble the immutable legal record for a set of bookings: Wielo Terms +
 *  Privacy accepted at checkout, plus every host policy snapshot the guest
 *  agreed to. Returns groups sorted newest-first; bookings with no documents are
 *  dropped. */
export async function assembleBookingLegal(
  admin: AdminClient,
  bookings: BookingLegalInput[],
): Promise<BookingLegalGroup[]> {
  if (bookings.length === 0) return [];

  const [placedTerms, placedPrivacy] = await Promise.all([
    getPlacedDocument("terms"),
    getPlacedDocument("privacy"),
  ]);

  const bookingIds = bookings.map((b) => b.id);
  const { data: snaps } = await admin
    .from("policy_snapshots")
    .select(
      "id, booking_id, policy_type, policy_name, policy_version, snapshot_data",
    )
    .in("booking_id", bookingIds)
    .order("policy_type", { ascending: true });

  const snapsByBooking = new Map<string, Record<string, unknown>[]>();
  for (const s of snaps ?? []) {
    const bid = s.booking_id as string;
    const arr = snapsByBooking.get(bid) ?? [];
    arr.push(s);
    snapsByBooking.set(bid, arr);
  }

  const groups: BookingLegalGroup[] = [];
  for (const b of bookings) {
    const docs: LegalDoc[] = [];
    if (b.termsVersion != null)
      docs.push(
        platformDoc(
          "Terms of Service",
          b.termsVersion,
          placedTerms,
          b.reference,
          `terms-${b.id}`,
        ),
      );
    if (b.privacyVersion != null)
      docs.push(
        platformDoc(
          "Privacy Policy",
          b.privacyVersion,
          placedPrivacy,
          b.reference,
          `privacy-${b.id}`,
        ),
      );
    for (const s of snapsByBooking.get(b.id) ?? []) {
      docs.push({
        id: s.id as string,
        kind: "Booking policy",
        title: `${s.policy_name as string}`,
        version: `v${s.policy_version}`,
        acceptedAt: "",
        ip: null,
        signatory: null,
        sha256: null,
        bodyHtml: renderPolicySnapshot(
          s.snapshot_data as Record<string, unknown>,
        ),
        context: String(s.policy_type).replace(/_/g, " "),
      });
    }
    if (docs.length === 0) continue;
    groups.push({
      bookingId: b.id,
      reference: b.reference,
      date: b.date,
      role: b.role,
      counterparty: b.counterparty,
      docs,
    });
  }
  groups.sort((a, b) => b.date.localeCompare(a.date));
  return groups;
}
