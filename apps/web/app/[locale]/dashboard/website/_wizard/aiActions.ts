"use server";

// Wizard AI content actions (wizard arc slice 3).
//
// generateSiteContentAction: the one-shot "Build my site" generation (Sonnet) —
//   turns the host's short answers into polished copy, validated + persisted to
//   host_websites.content_profile.
// regenerateSlotAction: regenerate a single text slot (Haiku) for the review step.
//
// Both are owner-scoped + feature-gated, and inert (return "ai_not_configured")
// until ANTHROPIC_API_KEY is set. They only ever WRITE the content profile;
// nothing here touches prices or publishes.
import { z } from "zod";

import { assertFullHost } from "@/lib/host/current";
import { hostHasFeature } from "@/lib/products/featureGate";
import { createServerClient } from "@/lib/supabase/server";
import {
  AiUnavailableError,
  aiConfigured,
  generateJson,
} from "@/lib/ai/client";
import {
  AI_STRING_SLOTS,
  aiContentJsonSchema,
  aiContentSchema,
  aiContentToProfile,
  mergeContentProfile,
  stringSlotToProfile,
  type AiStringSlot,
} from "@/lib/website/aiContent";
import {
  buildSiteContentPrompt,
  buildSlotRegenPrompt,
  type SiteContext,
} from "@/lib/website/aiPrompts";
import {
  parseContentProfileLoose,
  type ContentProfile,
} from "@/lib/website/contentProfile.schema";

const siteAnswersSchema = z.object({
  special: z.string().max(2000).optional(),
  story: z.string().max(4000).optional(),
  thingsToDo: z.array(z.string().max(500)).max(6).optional(),
});
export type SiteAnswersInput = z.infer<typeof siteAnswersSchema>;

type GenerateResult =
  | { ok: true; profile: ContentProfile }
  | { ok: false; error: string };

type RegenResult =
  | { ok: true; slot: AiStringSlot; value: string }
  | { ok: false; error: string };

/** Owner-scoped fetch of the site + the context the prompt needs. */
async function loadSiteForAi(websiteId: string): Promise<
  | {
      ok: true;
      hostId: string;
      profile: ContentProfile;
      ctx: SiteContext;
    }
  | { ok: false; error: string }
> {
  const host = await assertFullHost();
  if (!host.ok) return { ok: false, error: "not_authorized" };
  const supabase = createServerClient();
  const { data: site } = await supabase
    .from("host_websites")
    .select("id, brand, content_profile")
    .eq("id", websiteId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return { ok: false, error: "not_found" };
  if (!(await hostHasFeature(host.hostId, "website_builder"))) {
    return { ok: false, error: "locked" };
  }

  const { data: hostRow } = await supabase
    .from("hosts")
    .select("display_name")
    .eq("id", host.hostId)
    .maybeSingle();

  const brand = (site.brand ?? {}) as { name?: string; tagline?: string };
  return {
    ok: true,
    hostId: host.hostId,
    profile: parseContentProfileLoose(site.content_profile),
    ctx: {
      businessName: brand.name ?? "",
      tagline: brand.tagline,
      hostName: hostRow?.display_name ?? undefined,
    },
  };
}

async function persistProfile(
  websiteId: string,
  profile: ContentProfile,
): Promise<boolean> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_websites")
    .update({ content_profile: profile })
    .eq("id", websiteId);
  return !error;
}

export async function generateSiteContentAction(
  websiteId: string,
  answers: SiteAnswersInput,
): Promise<GenerateResult> {
  const parsedAnswers = siteAnswersSchema.safeParse(answers);
  if (!parsedAnswers.success) return { ok: false, error: "invalid_input" };
  if (!aiConfigured()) return { ok: false, error: "ai_not_configured" };

  const loaded = await loadSiteForAi(websiteId);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const { system, prompt } = buildSiteContentPrompt(
    loaded.ctx,
    parsedAnswers.data,
  );

  let raw: unknown;
  try {
    raw = await generateJson({
      system,
      prompt,
      tier: "quality",
      jsonSchema: aiContentJsonSchema,
      toolName: "site_content",
      toolDescription: "Return the website copy for this business.",
      maxTokens: 2000,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return { ok: false, error: "ai_not_configured" };
    }
    return { ok: false, error: "ai_failed" };
  }

  const parsed = aiContentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ai_invalid" };

  const merged = mergeContentProfile(
    loaded.profile,
    aiContentToProfile(parsed.data),
  );
  if (!(await persistProfile(websiteId, merged))) {
    return { ok: false, error: "save_failed" };
  }
  return { ok: true, profile: merged };
}

/**
 * Wizard-time generation: the site doesn't exist yet, so this returns the
 * generated ContentProfile WITHOUT persisting. The wizard holds it in state and
 * hands it to createWebsiteWithWizardAction, which seeds + hydrates in one shot.
 */
export async function generateWizardContentAction(
  siteName: string,
  answers: SiteAnswersInput,
): Promise<GenerateResult> {
  const parsedAnswers = siteAnswersSchema.safeParse(answers);
  if (!parsedAnswers.success) return { ok: false, error: "invalid_input" };
  if (!aiConfigured()) return { ok: false, error: "ai_not_configured" };

  const host = await assertFullHost();
  if (!host.ok) return { ok: false, error: "not_authorized" };
  if (!(await hostHasFeature(host.hostId, "website_builder"))) {
    return { ok: false, error: "locked" };
  }

  const supabase = createServerClient();
  const { data: hostRow } = await supabase
    .from("hosts")
    .select("display_name")
    .eq("id", host.hostId)
    .maybeSingle();

  const { system, prompt } = buildSiteContentPrompt(
    {
      businessName: (siteName ?? "").trim(),
      hostName: hostRow?.display_name ?? undefined,
    },
    parsedAnswers.data,
  );

  let raw: unknown;
  try {
    raw = await generateJson({
      system,
      prompt,
      tier: "quality",
      jsonSchema: aiContentJsonSchema,
      toolName: "site_content",
      toolDescription: "Return the website copy for this business.",
      maxTokens: 2000,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return { ok: false, error: "ai_not_configured" };
    }
    return { ok: false, error: "ai_failed" };
  }

  const parsed = aiContentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ai_invalid" };
  return { ok: true, profile: aiContentToProfile(parsed.data) };
}

const regenResultSchema = z.object({ value: z.string().max(4000) });
const regenJsonSchema = {
  type: "object",
  properties: {
    value: { type: "string", description: "The rewritten copy." },
  },
  required: ["value"],
} as const;

export async function regenerateSlotAction(
  websiteId: string,
  slot: AiStringSlot,
  answers: SiteAnswersInput,
): Promise<RegenResult> {
  if (!AI_STRING_SLOTS.includes(slot)) {
    return { ok: false, error: "invalid_slot" };
  }
  const parsedAnswers = siteAnswersSchema.safeParse(answers);
  if (!parsedAnswers.success) return { ok: false, error: "invalid_input" };
  if (!aiConfigured()) return { ok: false, error: "ai_not_configured" };

  const loaded = await loadSiteForAi(websiteId);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const { system, prompt } = buildSlotRegenPrompt(
    slot,
    loaded.ctx,
    parsedAnswers.data,
  );

  let raw: unknown;
  try {
    raw = await generateJson({
      system,
      prompt,
      tier: "fast",
      jsonSchema: regenJsonSchema,
      toolName: "rewrite",
      toolDescription: "Return the rewritten copy.",
      maxTokens: 600,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return { ok: false, error: "ai_not_configured" };
    }
    return { ok: false, error: "ai_failed" };
  }

  const parsed = regenResultSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.value.trim()) {
    return { ok: false, error: "ai_invalid" };
  }

  const merged = mergeContentProfile(
    loaded.profile,
    stringSlotToProfile(slot, parsed.data.value.trim()),
  );
  if (!(await persistProfile(websiteId, merged))) {
    return { ok: false, error: "save_failed" };
  }
  return { ok: true, slot, value: parsed.data.value.trim() };
}
