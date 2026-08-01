import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveLeadSource } from "./leadSource";

// Drop a Hosts-pipeline card the moment someone STARTS host signup (auth account
// created, onboarding not yet finished) so stalled signups are visible to sales
// at stage "New". Called best-effort from the host createAccountAction — a
// pipeline failure must never block signup.
//
// Idempotent: UNIQUE(user_id, audience) means a returning lead (e.g. a /go/hosts
// funnel lead who now signs up, or a re-submit) keeps their existing card + its
// attribution/stage — we only ever ADD the card, never downgrade it. Completing
// onboarding advances the card to "Signed up" (the on_host_created DB trigger);
// a trial or payment moves it on (existing subscription/ledger triggers).
//
// Only the host-signup path calls this — a pure /signup/guest account must never
// appear on the host board (plan §1: guests have no host sales motion).

export async function createHostSignupLeadCard(
  admin: SupabaseClient,
  input: { userId: string },
): Promise<void> {
  // The board's top-of-funnel stage.
  const { data: stage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("audience", "host")
    .eq("key", "new")
    .maybeSingle();
  if (!stage) return;

  // Affiliate attribution is already bound at this point (bindAffiliateReferral
  // runs earlier in the signup action). Resolve how the card records its source:
  // competition affiliate link → 'competition', normal affiliate link →
  // 'affiliate_referral', otherwise a plain 'direct' signup.
  const src = await resolveLeadSource(admin, input.userId);
  const sourceKind = src.sourceKind ?? "direct";
  const sourceLabel = src.sourceLabel;
  const affiliateRef = src.affiliateRef;

  // Insert-if-absent. ignoreDuplicates → a real insert returns the row; an
  // existing card returns null, so the "created" activity only fires once.
  const { data: inserted } = await admin
    .from("pipeline_leads")
    .upsert(
      {
        user_id: input.userId,
        audience: "host",
        stage_id: stage.id,
        source_kind: sourceKind,
        source_label: sourceLabel,
        affiliate_ref: affiliateRef,
        suppress_default_nurture: src.suppressNurture,
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "user_id,audience", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (inserted?.id) {
    await admin.from("pipeline_activities").insert({
      lead_id: inserted.id,
      staff_id: null,
      kind: "created",
      body: "Started host signup.",
      meta: { source_kind: sourceKind, system: true, signup: true },
    });
  }
}
