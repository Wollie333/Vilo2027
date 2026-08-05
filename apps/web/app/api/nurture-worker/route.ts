import { NextResponse } from "next/server";

import { referralNextLink } from "@/lib/affiliate/links";
import { createAdminClient } from "@/lib/supabase/admin";

// Nurture drip worker. Pinged each minute by the drain-nurture pg_cron
// (20260801110000). For every DUE, active enrolment (next_send_at <= now) it
// sends the current step's email, logs an email_sent activity on the lead, and
// advances the enrolment (or completes it). Mirrors the review-request-worker:
// same shared EMAIL_WORKER_SECRET bearer, batch drain, terminal-vs-retry stamps.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorised(req: Request): boolean {
  const expected = process.env.EMAIL_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

// CTA path per step. The href is built at send time and routed through the
// referring partner's /r link when the lead was referred (affiliate_ref), so
// every CTA credits the affiliate who brought them in — otherwise the plain link.
const STEP_CTA: Record<string, string> = {
  nurture_host_offer: "/signup/host",
  nurture_affiliate_offer: "/signup/partner",
};

// Inline step bodies keyed by nurture_steps.email_type. Deliberately simple
// transactional HTML (same Resend path as the funnel resource email) — polished
// React Email templates are a later refinement. Subject comes from the step's
// subject_override.
const STEP_BODIES: Record<string, (firstName: string, cta: string) => string> =
  {
    nurture_host_welcome: (n) =>
      `<p>Hi ${n},</p><p>Thanks for grabbing the Direct Booking Starter Kit. Start with the pricing worksheet — it's the fastest win. Reply any time if you get stuck.</p>`,
    nurture_host_value: (n) =>
      `<p>Hi ${n},</p><p>Every OTA booking quietly takes a cut. On Wielo your payout is exactly what the guest pays — 0% commission. Here's how hosts move their calendar across in an afternoon.</p>`,
    nurture_host_offer: (n, cta) =>
      `<p>Hi ${n},</p><p>Ready to take direct bookings? Set up your booking page, calendar and checkout on Wielo — free to start, no card. <a href="${cta}" style="color:#10B981;font-weight:600">Start your free host account →</a></p>`,
    nurture_affiliate_welcome: (n) =>
      `<p>Hi ${n},</p><p>Welcome to the Wielo partner programme. The quickest first win: grab your personal referral link from the Partner Pack and share it with one host you already know. When they pay, you earn — for as long as they stay.</p>`,
    nurture_affiliate_value: (n) =>
      `<p>Hi ${n},</p><p>Wielo is 0%-commission direct-booking management, so hosts keep every rand — an easy thing to recommend. You earn recurring commission on every payment a referred host makes, paid out in rand, with a live dashboard tracking your clicks and earnings.</p>`,
    nurture_affiliate_offer: (n, cta) =>
      `<p>Hi ${n},</p><p>Ready to start earning? Activate your partner account to get your referral link and earnings dashboard — free to join, no minimums. <a href="${cta}" style="color:#10B981;font-weight:600">Become a Wielo partner →</a></p>`,
  };

function bodyFor(
  emailType: string,
  firstName: string,
  affiliateRef: string | null,
): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const path = STEP_CTA[emailType];
  const cta = path ? referralNextLink(base, affiliateRef, path) : "";
  const fn = STEP_BODIES[emailType];
  const inner = fn
    ? fn(firstName, cta)
    : `<p>Hi ${firstName},</p><p>A quick note from the Wielo host team.</p>`;
  return `${inner}<p style="color:#6b7280;font-size:12px">Sent by Wielo — direct-booking management for South African hosts. <a href="${base}/unsubscribe">Unsubscribe</a></p>`;
}

type Step = {
  step_order: number;
  delay_hours: number;
  email_type: string;
  subject_override: string | null;
};

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: rows, error } = await admin
      .from("nurture_enrollments")
      .select(
        "id, current_step, sequence_id, lead_id, pipeline_leads(marketing_consent, affiliate_ref, status, pipeline_stages(is_customer), user_profiles(full_name, email))",
      )
      .eq("status", "active")
      .not("next_send_at", "is", null)
      .lte("next_send_at", nowIso)
      .order("next_send_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    const { sendTransactionalEmail } = await import("@/lib/email/send");
    const stepsCache = new Map<string, Step[]>();
    let sent = 0;
    let completed = 0;
    let cancelled = 0;

    for (const row of rows ?? []) {
      const lead = row.pipeline_leads as {
        marketing_consent?: boolean;
        affiliate_ref?: string | null;
        status?: string;
        pipeline_stages?: { is_customer?: boolean } | null;
        user_profiles?: { full_name?: string; email?: string } | null;
      } | null;
      const email = lead?.user_profiles?.email ?? null;
      const consent = Boolean(lead?.marketing_consent);

      // Consent withdrawn (or no email) → stop the sequence.
      if (!consent || !email) {
        await admin
          .from("nurture_enrollments")
          .update({ status: "unsubscribed" })
          .eq("id", row.id);
        cancelled += 1;
        continue;
      }

      // Conversion / churn cancels the drip — the pipeline lifecycle drives the
      // emails. A lead who started a trial or paid (customer stage / won) has
      // converted; one who lapsed (lost / churned) is out. Either way, stop
      // sending "become a host" nudges to someone past that point.
      const stg = lead?.pipeline_stages as { is_customer?: boolean } | null;
      const st = lead?.status;
      const converted = Boolean(stg?.is_customer) || st === "won";
      const dead = st === "lost" || st === "churned";
      if (converted || dead) {
        await admin
          .from("nurture_enrollments")
          .update({ status: converted ? "converted" : "cancelled" })
          .eq("id", row.id);
        cancelled += 1;
        continue;
      }

      // Active steps for this sequence (cached).
      let steps = stepsCache.get(row.sequence_id);
      if (!steps) {
        const { data: stepRows } = await admin
          .from("nurture_steps")
          .select("step_order, delay_hours, email_type, subject_override")
          .eq("sequence_id", row.sequence_id)
          .eq("is_active", true)
          .order("step_order");
        steps = (stepRows ?? []) as Step[];
        stepsCache.set(row.sequence_id, steps);
      }

      const step = steps[row.current_step];
      if (!step) {
        await admin
          .from("nurture_enrollments")
          .update({ status: "completed" })
          .eq("id", row.id);
        completed += 1;
        continue;
      }

      const firstName =
        lead?.user_profiles?.full_name?.trim().split(" ")[0] || "there";

      // Send (best-effort; a bounce doesn't block advancing the sequence).
      try {
        await sendTransactionalEmail({
          to: email,
          subject: step.subject_override || "A note from Wielo",
          html: bodyFor(
            step.email_type,
            firstName,
            lead?.affiliate_ref ?? null,
          ),
        });
      } catch {
        // swallow — advance anyway so a hard-bouncing address doesn't wedge.
      }

      // Log on the lead's timeline.
      await admin.from("pipeline_activities").insert({
        lead_id: row.lead_id,
        staff_id: null,
        kind: "email_sent",
        body: `Nurture email sent: ${step.subject_override || step.email_type}.`,
        meta: { step_order: step.step_order, email_type: step.email_type },
      });

      // Advance (or complete).
      const nextIdx = row.current_step + 1;
      const nextStep = steps[nextIdx];
      if (!nextStep) {
        await admin
          .from("nurture_enrollments")
          .update({ current_step: nextIdx, status: "completed" })
          .eq("id", row.id);
        completed += 1;
      } else {
        const nextSend = new Date(
          Date.now() + nextStep.delay_hours * 3_600_000,
        ).toISOString();
        await admin
          .from("nurture_enrollments")
          .update({ current_step: nextIdx, next_send_at: nextSend })
          .eq("id", row.id);
      }
      sent += 1;
    }

    return NextResponse.json({
      success: true,
      data: { processed: rows?.length ?? 0, sent, completed, cancelled },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { code: "NURTURE_WORKER_FAILED", message } },
      { status: 500 },
    );
  }
}
