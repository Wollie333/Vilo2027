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

import { requireHost } from "@/lib/host/current";
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
  clampSlot,
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
  | { ok: false; error: string; detail?: string };

type RegenResult =
  | { ok: true; slot: AiStringSlot; value: string }
  | { ok: false; error: string; detail?: string };

/** Format a `HH:MM(:SS)` time to `HH:MM` (or null when absent). */
function fmtTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return h && m ? `${h.padStart(2, "0")}:${m}` : t.trim();
}

/**
 * The host's REAL account context — so the copywriter writes accurate, grounded
 * copy from known facts instead of generalities, and never invents. Pulls what the
 * host already captured at onboarding: property + rooms (with prices/descriptions),
 * add-ons, policies, their own bio, reputation, and — crucially — real published
 * GUEST REVIEWS, which the AI mines for the authentic themes guests value.
 * Best-effort: any part may be empty; a read failure just drops that field.
 */
async function loadHostAiFacts(hostId: string): Promise<{
  location?: string;
  propertyDescription?: string;
  rooms?: string;
  hostBio?: string;
  policies?: string;
  addOns?: string;
  highlights?: string[];
  rating?: string;
  reviews?: string[];
}> {
  const supabase = createServerClient();

  const [{ data: hostRow }, { data: biz }, { data: prop }] = await Promise.all([
    supabase
      .from("hosts")
      .select("bio, highlights, avg_rating, total_reviews, is_superhost")
      .eq("id", hostId)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("city, province")
      .eq("host_id", hostId)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle(),
    supabase
      .from("properties")
      .select(
        "id, description, city, province, cancellation_policy_label, check_in_time, check_out_time, house_rules",
      )
      .eq("host_id", hostId)
      .is("deleted_at", null)
      .order("is_published", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Rooms — name, sleeps, from-price, short description.
  let rooms: string | undefined;
  if (prop?.id) {
    const { data: rms } = await supabase
      .from("property_rooms")
      .select("name, max_guests, base_price, description")
      .eq("property_id", prop.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(6);
    const parts = (rms ?? [])
      .map((r) => {
        const meta: string[] = [];
        if (r.max_guests) meta.push(`sleeps ${r.max_guests}`);
        if (r.base_price) meta.push(`from R${Math.round(r.base_price)}`);
        let s = String(r.name) + (meta.length ? ` (${meta.join(", ")})` : "");
        const d = r.description?.trim();
        if (d) s += ` — ${d.slice(0, 160)}`;
        return s;
      })
      .filter(Boolean);
    rooms = parts.length ? parts.join("; ") : undefined;
  }

  // Add-ons / extras the host offers (host-scoped, active).
  let addOns: string | undefined;
  {
    const { data: adr } = await supabase
      .from("addons")
      .select("name, description")
      .eq("host_id", hostId)
      .eq("is_active", true)
      .limit(8);
    const parts = (adr ?? [])
      .map((a) => {
        const d = a.description?.trim();
        return d ? `${a.name} — ${d.slice(0, 120)}` : String(a.name);
      })
      .filter(Boolean);
    addOns = parts.length ? parts.join("; ") : undefined;
  }

  // Real published guest reviews — the authentic sentiment the AI writes from.
  let reviews: string[] | undefined;
  {
    const { data: revs } = await supabase
      .from("reviews")
      .select("body, rating, trip_type")
      .eq("host_id", hostId)
      .eq("is_published", true)
      .eq("flagged", false)
      .not("body", "is", null)
      .order("helpful_count", { ascending: false })
      .limit(8);
    const parts = (revs ?? [])
      .map((r) => {
        const b = r.body?.trim();
        if (!b) return null;
        const trip = r.trip_type ? ` (${r.trip_type})` : "";
        return `${r.rating}★${trip}: ${b.slice(0, 280)}`;
      })
      .filter((v): v is string => Boolean(v));
    reviews = parts.length ? parts : undefined;
  }

  // Reputation trust signal.
  let rating: string | undefined;
  if (hostRow?.avg_rating && hostRow.total_reviews) {
    const n = hostRow.total_reviews;
    rating =
      `${Number(hostRow.avg_rating).toFixed(1)}★ from ${n} review${n === 1 ? "" : "s"}` +
      (hostRow.is_superhost ? " · Superhost" : "");
  }

  // Booking policies in plain words.
  const polParts: string[] = [];
  const cancel = prop?.cancellation_policy_label?.trim();
  if (cancel) polParts.push(`Cancellation — ${cancel}`);
  const ci = fmtTime(prop?.check_in_time);
  const co = fmtTime(prop?.check_out_time);
  if (ci || co) {
    polParts.push(
      `Check-in from ${ci ?? "flexible"}, check-out by ${co ?? "flexible"}`,
    );
  }
  const houseRules = prop?.house_rules?.trim();
  if (houseRules) polParts.push(`House rules — ${houseRules.slice(0, 220)}`);
  const policies = polParts.length ? polParts.join(". ") : undefined;

  const highlights = ((hostRow?.highlights ?? []) as string[])
    .map((h) => h?.trim())
    .filter((v): v is string => Boolean(v));

  const location =
    [prop?.city ?? biz?.city, prop?.province ?? biz?.province]
      .filter(Boolean)
      .join(", ") || undefined;

  return {
    location,
    propertyDescription: prop?.description ?? undefined,
    rooms,
    hostBio: hostRow?.bio?.trim() || undefined,
    policies,
    addOns,
    highlights: highlights.length ? highlights : undefined,
    rating,
    reviews,
  };
}

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
  const host = await requireHost();
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
  const facts = await loadHostAiFacts(host.hostId);
  return {
    ok: true,
    hostId: host.hostId,
    profile: parseContentProfileLoose(site.content_profile),
    ctx: {
      businessName: brand.name ?? "",
      tagline: brand.tagline,
      hostName: hostRow?.display_name ?? undefined,
      ...facts,
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
  if (!parsedAnswers.success) {
    const detail = parsedAnswers.error.issues
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    console.error(`[ai] invalid answers: ${detail}`);
    return { ok: false, error: "invalid_input", detail };
  }
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
    // Surface the real provider error (e.g. a retired model id or a bad key) —
    // logged for the runtime logs AND returned as `detail` so the wizard can
    // show exactly what went wrong instead of a generic "couldn't write".
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[ai] generate failed: ${detail}`);
    return { ok: false, error: "ai_failed", detail };
  }

  const parsed = aiContentSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    console.error(
      `[ai] response schema mismatch: ${detail} | raw=${JSON.stringify(raw).slice(0, 300)}`,
    );
    return { ok: false, error: "ai_invalid", detail };
  }

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
  if (!parsedAnswers.success) {
    const detail = parsedAnswers.error.issues
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    console.error(`[ai] invalid answers: ${detail}`);
    return { ok: false, error: "invalid_input", detail };
  }
  if (!aiConfigured()) return { ok: false, error: "ai_not_configured" };

  const host = await requireHost();
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
  const facts = await loadHostAiFacts(host.hostId);

  const { system, prompt } = buildSiteContentPrompt(
    {
      businessName: (siteName ?? "").trim(),
      hostName: hostRow?.display_name ?? undefined,
      ...facts,
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
    // Surface the real provider error (e.g. a retired model id or a bad key) —
    // logged for the runtime logs AND returned as `detail` so the wizard can
    // show exactly what went wrong instead of a generic "couldn't write".
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[ai] generate failed: ${detail}`);
    return { ok: false, error: "ai_failed", detail };
  }

  const parsed = aiContentSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    console.error(
      `[ai] response schema mismatch: ${detail} | raw=${JSON.stringify(raw).slice(0, 300)}`,
    );
    return { ok: false, error: "ai_invalid", detail };
  }
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

/**
 * Wizard-time single-slot write: like regenerateSlotAction but for a site that
 * doesn't exist yet — generates copy for ONE section field and returns it WITHOUT
 * persisting. The per-page content step holds it in state; it lands in the right
 * section at build via hydrateProfile (SLOT_BINDINGS). Fast tier (Haiku).
 */
export async function writeWizardSlotAction(
  siteName: string,
  slot: AiStringSlot,
  answers: SiteAnswersInput,
): Promise<RegenResult> {
  if (!AI_STRING_SLOTS.includes(slot)) {
    return { ok: false, error: "invalid_slot" };
  }
  const parsedAnswers = siteAnswersSchema.safeParse(answers);
  if (!parsedAnswers.success) {
    const detail = parsedAnswers.error.issues
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: "invalid_input", detail };
  }
  if (!aiConfigured()) return { ok: false, error: "ai_not_configured" };

  const host = await requireHost();
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
  const facts = await loadHostAiFacts(host.hostId);

  const { system, prompt } = buildSlotRegenPrompt(
    slot,
    {
      businessName: (siteName ?? "").trim(),
      hostName: hostRow?.display_name ?? undefined,
      ...facts,
    },
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
      toolDescription: "Return the copy.",
      maxTokens: 600,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return { ok: false, error: "ai_not_configured" };
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[ai] slot write failed: ${detail}`);
    return { ok: false, error: "ai_failed", detail };
  }

  const parsed = regenResultSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.value.trim()) {
    return { ok: false, error: "ai_invalid" };
  }
  return { ok: true, slot, value: clampSlot(slot, parsed.data.value) };
}

export async function regenerateSlotAction(
  websiteId: string,
  slot: AiStringSlot,
  answers: SiteAnswersInput,
): Promise<RegenResult> {
  if (!AI_STRING_SLOTS.includes(slot)) {
    return { ok: false, error: "invalid_slot" };
  }
  const parsedAnswers = siteAnswersSchema.safeParse(answers);
  if (!parsedAnswers.success) {
    const detail = parsedAnswers.error.issues
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    console.error(`[ai] invalid answers: ${detail}`);
    return { ok: false, error: "invalid_input", detail };
  }
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
    // Surface the real provider error (e.g. a retired model id or a bad key) —
    // logged for the runtime logs AND returned as `detail` so the wizard can
    // show exactly what went wrong instead of a generic "couldn't write".
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[ai] generate failed: ${detail}`);
    return { ok: false, error: "ai_failed", detail };
  }

  const parsed = regenResultSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.value.trim()) {
    return { ok: false, error: "ai_invalid" };
  }

  const value = clampSlot(slot, parsed.data.value);
  const merged = mergeContentProfile(
    loaded.profile,
    stringSlotToProfile(slot, value),
  );
  if (!(await persistProfile(websiteId, merged))) {
    return { ok: false, error: "save_failed" };
  }
  return { ok: true, slot, value };
}
