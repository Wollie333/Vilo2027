"use server";

import { z } from "zod";

import { notifyAdmins } from "@/lib/admin/notify";
import { createAdminClient } from "@/lib/supabase/admin";

import { REPORT_REASONS } from "./report-constants";

// Public "Report this listing" submission. Anonymous reporters allowed, so we
// insert with the service-role client (bypasses RLS) and keep it best-effort +
// spam-guarded (honeypot). Admins are notified via the admin "Latest actions"
// feed and triage under Moderation → Flagged Listings.

const reportSchema = z.object({
  propertyId: z.string().uuid(),
  reporterName: z.string().trim().min(1, "Your name is required.").max(120),
  reporterEmail: z.string().trim().email("Enter a valid email.").max(200),
  reporterPhone: z.string().trim().max(40).optional().or(z.literal("")),
  reason: z.enum([
    "scam",
    "not_real",
    "inappropriate",
    "safety",
    "spam",
    "other",
  ]),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters).")
    .max(2000),
  hp: z.string().optional(), // honeypot
});

export type ReportListingResult = { ok: true } | { ok: false; error: string };

export async function reportListingAction(
  input: unknown,
): Promise<ReportListingResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }
  const d = parsed.data;

  // Honeypot filled → a bot. Pretend success, write nothing.
  if (d.hp && d.hp.trim().length > 0) return { ok: true };

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("properties")
    .select("id, name, host_id")
    .eq("id", d.propertyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };

  const { error } = await admin.from("listing_reports").insert({
    property_id: listing.id,
    listing_name: listing.name,
    host_id: listing.host_id,
    reporter_name: d.reporterName,
    reporter_email: d.reporterEmail,
    reporter_phone: d.reporterPhone?.trim() || null,
    reason: d.reason,
    message: d.message,
  });
  if (error) {
    return { ok: false, error: "Could not submit your report. Try again." };
  }

  const reasonLabel =
    REPORT_REASONS.find((r) => r.value === d.reason)?.label ?? d.reason;
  await notifyAdmins(admin, {
    category: "support",
    kind: "listing_report_filed",
    title: `Listing reported — ${reasonLabel}`,
    body: `${listing.name ?? "A listing"} was reported by ${d.reporterName}.`,
    hostId: listing.host_id,
    href: "/admin/flagged-listings",
  });

  return { ok: true };
}
