import { z } from "zod";

import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { assertHumanOrInfraFailure } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";

// Core of the public funnel submit (/api/funnel-submit). Design-independent: the
// landing page and form are just a UI over this. Proves the whole spine —
// identity + affiliate binding + pipeline card + resource email — per
// docs/features/FUNNEL_MANAGER_PLAN.md §4.
//
// A "lead" is NOT a new row type: findOrCreateLeadIdentity mints/returns a
// user_profiles row (is_lead=true) and binds any affiliate referral. We only add
// the CRM card (pipeline_leads) that references that identity.
//
// Never throws for expected failures — returns { ok:false, error } so the route
// can always answer 200 and the browser shows a real message.

const submitSchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  establishment_address: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("")),
  marketing_consent: z.boolean().optional().default(false),
  utm: z.record(z.string(), z.string()).optional(),
  ad_source: z.string().trim().max(120).optional().or(z.literal("")),
  // Honeypot: a real user never fills this. Bots do.
  hp: z.string().optional(),
});

export type FunnelSubmitResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export async function submitFunnelLead(
  input: unknown,
  opts: { turnstileToken?: string; clientIp?: string },
): Promise<FunnelSubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Please check the form and try again.",
    };
  }
  const d = parsed.data;
  const thanks = `/go/${encodeURIComponent(d.slug)}/thanks`;

  // Honeypot tripped → look successful, write nothing.
  if (d.hp && d.hp.trim().length > 0) {
    return { ok: true, redirectTo: thanks };
  }

  // Turnstile: inert until NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY
  // are set, fail-closed once configured (infra/config errors soft-pass).
  const gate = await assertHumanOrInfraFailure(
    opts.turnstileToken,
    opts.clientIp,
    "funnel-submit",
  );
  if (!gate.allowed) {
    return {
      ok: false,
      error:
        "We couldn't verify you're human. Please retry the check and submit again.",
    };
  }

  const admin = createAdminClient();

  // 1. Resolve the funnel.
  const { data: funnel } = await admin
    .from("funnels")
    .select(
      "id, audience, slug, name, sequence_id, brochure_path, brochure_name, video_url, is_active",
    )
    .eq("slug", d.slug)
    .maybeSingle();
  if (!funnel || !funnel.is_active) {
    return { ok: false, error: "This page is no longer available." };
  }

  // 2. Mint / find the lead identity (also binds the vilo_ref affiliate referral).
  const identity = await findOrCreateLeadIdentity(admin, {
    email: d.email,
    name: d.name,
    phone: d.phone || null,
  });
  if (!identity) {
    return {
      ok: false,
      error: "Something went wrong creating your account. Please try again.",
    };
  }

  // 3. Resolve the board's "New" stage.
  const { data: stage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("audience", funnel.audience)
    .eq("key", "new")
    .maybeSingle();
  if (!stage) {
    return {
      ok: false,
      error: "The pipeline isn't configured yet. Please try again later.",
    };
  }

  // 4. Affiliate attribution (denormalised for the board badge). The binding
  //    itself already happened inside findOrCreateLeadIdentity; here we just read
  //    it back to badge the card and, on the host board, flag the source.
  let affiliateRef: string | null = null;
  let sourceKind: string =
    funnel.audience === "affiliate" ? "affiliate_funnel" : "host_funnel";
  let sourceLabel: string | null = null;
  try {
    const { data: ref } = await admin
      .from("affiliate_referrals")
      .select("affiliate_accounts(slug)")
      .eq("referred_user_id", identity.guestId)
      .maybeSingle();
    const acct = ref?.affiliate_accounts as { slug?: string } | null;
    if (acct?.slug) {
      affiliateRef = acct.slug;
      if (funnel.audience === "host") {
        sourceKind = "affiliate_referral";
        sourceLabel = acct.slug;
      }
    }
  } catch {
    // best-effort — a missing referral just means an organic lead.
  }

  // Simple v1 lead score: a host lead that named an establishment is hotter.
  const hasAddress = Boolean(d.establishment_address?.trim());
  const score = funnel.audience === "host" && hasAddress ? 10 : 0;
  const nowIso = new Date().toISOString();

  // 5. Upsert the CRM card — one per (user, board). A returning lead keeps their
  //    stage/owner; we only touch activity, funnel, consent (never downgraded),
  //    and attribution.
  const { data: existing } = await admin
    .from("pipeline_leads")
    .select("id, marketing_consent")
    .eq("user_id", identity.guestId)
    .eq("audience", funnel.audience)
    .maybeSingle();

  let leadId: string;
  let isNewCard = false;
  if (existing) {
    const update: Record<string, unknown> = {
      funnel_id: funnel.id,
      last_activity_at: nowIso,
    };
    if (d.marketing_consent) update.marketing_consent = true; // upgrade only
    if (affiliateRef) {
      update.affiliate_ref = affiliateRef;
      update.source_kind = sourceKind;
      update.source_label = sourceLabel;
    }
    await admin.from("pipeline_leads").update(update).eq("id", existing.id);
    leadId = existing.id;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("pipeline_leads")
      .insert({
        user_id: identity.guestId,
        funnel_id: funnel.id,
        audience: funnel.audience,
        stage_id: stage.id,
        source_kind: sourceKind,
        source_label: sourceLabel,
        affiliate_ref: affiliateRef,
        score,
        utm: d.utm ?? {},
        ad_source: d.ad_source || null,
        marketing_consent: d.marketing_consent ?? false,
        last_activity_at: nowIso,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return {
        ok: false,
        error: "Couldn't save your details. Please try again.",
      };
    }
    leadId = inserted.id;
    isNewCard = true;
  }

  // 6. Timeline entry (append-only). System action → staff_id null.
  await admin.from("pipeline_activities").insert({
    lead_id: leadId,
    staff_id: null,
    kind: isNewCard ? "created" : "note",
    body: isNewCard
      ? `Lead captured via ${funnel.name}.`
      : `Re-submitted ${funnel.name}.`,
    meta: {
      source_kind: sourceKind,
      establishment_address: d.establishment_address || null,
      utm: d.utm ?? {},
      ad_source: d.ad_source || null,
    },
  });

  // 7. Resource-delivery email (transactional, best-effort — the lead is already
  //    captured). Placeholder-safe: if no brochure/video is set yet, it's a plain
  //    thank-you.
  try {
    const firstName = d.name.trim().split(" ")[0] || "there";
    let brochureUrl: string | null = null;
    if (funnel.brochure_path) {
      brochureUrl =
        admin.storage.from("funnel-assets").getPublicUrl(funnel.brochure_path)
          .data.publicUrl ?? null;
    }
    const esc = (s: string) =>
      s.replace(
        /[<>&]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
      );
    const parts = [`<p>Hi ${esc(firstName)},</p>`];
    if (brochureUrl) {
      parts.push(
        `<p>Here's your guide: <a href="${brochureUrl}" style="color:#10B981;font-weight:600">Download the ${esc(funnel.brochure_name || "guide")} (PDF) &rarr;</a></p>`,
      );
    } else {
      parts.push(
        `<p>Thanks for your interest in Wielo — we'll be in touch shortly with your guide and next steps.</p>`,
      );
    }
    parts.push(
      `<p style="color:#6b7280;font-size:12px">Sent by Wielo — direct-booking management for South African hosts.</p>`,
    );
    const { sendTransactionalEmail } = await import("@/lib/email/send");
    await sendTransactionalEmail({
      to: d.email.trim().toLowerCase(),
      subject: "Your Wielo Host Guide",
      html: parts.join(""),
    });
  } catch {
    // Email is best-effort; the lead is already captured.
  }

  // 8. Nurture enrolment — only when the lead consented, the card isn't suppressed,
  //    and the funnel's sequence is ACTIVE with at least one active step. Until
  //    Phase 4 activates the sequences + builds the drain-nurture worker, this is
  //    a no-op by design (seeded sequences are is_active=false).
  try {
    if (d.marketing_consent && funnel.sequence_id) {
      const { data: seq } = await admin
        .from("nurture_sequences")
        .select(
          "id, is_active, nurture_steps(id, is_active, delay_hours, step_order)",
        )
        .eq("id", funnel.sequence_id)
        .maybeSingle();
      const steps = (seq?.nurture_steps ?? []) as Array<{
        is_active: boolean;
        delay_hours: number;
        step_order: number;
      }>;
      const activeSteps = steps
        .filter((s) => s.is_active)
        .sort((a, b) => a.step_order - b.step_order);
      if (seq?.is_active && activeSteps.length > 0) {
        const firstDelayH = activeSteps[0]?.delay_hours ?? 0;
        const nextSendAt = new Date(
          Date.now() + firstDelayH * 3600_000,
        ).toISOString();
        await admin.from("nurture_enrollments").upsert(
          {
            lead_id: leadId,
            sequence_id: funnel.sequence_id,
            current_step: 0,
            next_send_at: nextSendAt,
            status: "active",
          },
          { onConflict: "lead_id,sequence_id", ignoreDuplicates: true },
        );
      }
    }
  } catch {
    // Enrolment is best-effort; the lead is captured and can be worked manually.
  }

  return { ok: true, redirectTo: thanks };
}
