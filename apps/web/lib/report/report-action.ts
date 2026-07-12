"use server";

import { z } from "zod";

import { notifyAdmins } from "@/lib/admin/notify";
import { createAdminClient } from "@/lib/supabase/admin";

import { REPORT_REASONS, REPORT_TARGET_META } from "./report-constants";

// Public report submission for a listing, deal (special) or user. Anonymous
// reporters are allowed, so we insert with the service-role client (bypasses
// RLS), honeypot-guarded. Admins are notified and triage under Moderation.

const reportSchema = z.object({
  targetType: z.enum(["listing", "deal", "user"]),
  targetId: z.string().uuid(),
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

export type ReportResult = { ok: true } | { ok: false; error: string };

type ResolvedTarget = {
  label: string;
  hostId: string | null;
  propertyId: string | null;
};

/** Resolve + verify the reported entity, returning a frozen label snapshot. */
async function resolveTarget(
  admin: ReturnType<typeof createAdminClient>,
  targetType: "listing" | "deal" | "user",
  targetId: string,
): Promise<ResolvedTarget | null> {
  if (targetType === "listing") {
    const { data } = await admin
      .from("properties")
      .select("id, name, host_id")
      .eq("id", targetId)
      .is("deleted_at", null)
      .maybeSingle();
    return data
      ? {
          label: data.name ?? "Listing",
          hostId: data.host_id,
          propertyId: data.id,
        }
      : null;
  }
  if (targetType === "deal") {
    const { data } = await admin
      .from("specials")
      .select("id, title, host_id, property_id")
      .eq("id", targetId)
      .maybeSingle();
    return data
      ? {
          label: data.title ?? "Deal",
          hostId: data.host_id,
          propertyId: data.property_id,
        }
      : null;
  }
  // user
  const { data } = await admin
    .from("user_profiles")
    .select("id, full_name, email")
    .eq("id", targetId)
    .maybeSingle();
  return data
    ? {
        label: data.full_name ?? data.email ?? "User",
        hostId: null,
        propertyId: null,
      }
    : null;
}

export async function reportAction(input: unknown): Promise<ReportResult> {
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
  const target = await resolveTarget(admin, d.targetType, d.targetId);
  if (!target) {
    return { ok: false, error: "That item could not be found." };
  }

  const { error } = await admin.from("listing_reports").insert({
    target_type: d.targetType,
    target_id: d.targetId,
    target_label: target.label,
    // Kept for listings so the FK cascade + admin "open listing" link still work.
    property_id: d.targetType === "listing" ? target.propertyId : null,
    listing_name: d.targetType === "listing" ? target.label : null,
    host_id: target.hostId,
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
  const noun = REPORT_TARGET_META[d.targetType].adminLabel;
  await notifyAdmins(admin, {
    category: "support",
    kind: "content_report_filed",
    title: `${noun} reported — ${reasonLabel}`,
    body: `${target.label} was reported by ${d.reporterName}.`,
    hostId: target.hostId ?? undefined,
    href: `/admin/flagged-listings?category=${d.targetType}`,
  });

  return { ok: true };
}
