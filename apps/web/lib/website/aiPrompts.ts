// Prompt construction for the wizard's AI content step. Wizard arc slice 3.
//
// Pure + testable: turns the host's short answers + a little account context into
// a system + user prompt. AI is used ONLY to polish/expand the host's own words
// into on-brand website copy — never to invent facts (amenities, prices, ratings,
// locations are supplied by the account, not the model).
import type { AiStringSlot } from "./aiContent";

export type SiteAnswers = {
  /** "In one line, what makes your place special?" */
  special?: string;
  /** "Tell us the story of your place / why you host." */
  story?: string;
  /** "Name up to 3 things guests love to do nearby." */
  thingsToDo?: string[];
};

export type SiteContext = {
  businessName: string;
  tagline?: string;
  location?: string;
  propertyDescription?: string;
  hostName?: string;
};

const SYSTEM = [
  "You are an expert hospitality copywriter for South African accommodation",
  "businesses. You write warm, concrete, guest-focused website copy in clear",
  "British/South African English.",
  "",
  "Rules:",
  "- Use ONLY the facts the host gives you. Never invent amenities, prices,",
  "  star ratings, distances, awards, or place names that aren't provided.",
  "- Expand the host's short notes into polished copy; keep their meaning.",
  "- Be concise and specific — avoid generic filler and clichés.",
  "- If there is nothing to say for a field, leave it empty rather than padding.",
  "- Return the result by calling the provided tool.",
].join("\n");

function contextBlock(ctx: SiteContext): string {
  const lines = [`Business name: ${ctx.businessName || "(unnamed)"}`];
  if (ctx.tagline) lines.push(`Existing tagline: ${ctx.tagline}`);
  if (ctx.location) lines.push(`Location: ${ctx.location}`);
  if (ctx.hostName) lines.push(`Host name: ${ctx.hostName}`);
  if (ctx.propertyDescription) {
    lines.push(`Property description: ${ctx.propertyDescription}`);
  }
  return lines.join("\n");
}

function answersBlock(answers: SiteAnswers): string {
  const lines: string[] = [];
  lines.push(
    `What makes the place special: ${answers.special?.trim() || "(not provided)"}`,
  );
  lines.push(
    `The host's story / why they host: ${answers.story?.trim() || "(not provided)"}`,
  );
  const todo = (answers.thingsToDo ?? []).map((t) => t.trim()).filter(Boolean);
  lines.push(
    `Things to do nearby: ${todo.length ? todo.join("; ") : "(not provided)"}`,
  );
  return lines.join("\n");
}

/** Build the full-generation prompt (Sonnet). */
export function buildSiteContentPrompt(
  ctx: SiteContext,
  answers: SiteAnswers,
): { system: string; prompt: string } {
  const prompt = [
    "Write the website copy for this accommodation business.",
    "",
    "ACCOUNT CONTEXT",
    contextBlock(ctx),
    "",
    "THE HOST'S ANSWERS",
    answersBlock(answers),
    "",
    "Produce, via the tool:",
    "- heroHeadline: a short, evocative home headline (≤ 8 words).",
    "- heroSubheadline: one warm supporting line.",
    "- aboutStory: the About story (2–4 sentences) from the host's story.",
    "- hostBioBody: a few warm lines about the host/team.",
    "- experiencesIntro: one line framing what's on offer nearby.",
    "- experiences: up to 3 items (title + one sentence + a fitting emoji) from",
    "  the things-to-do notes. Omit if none were given.",
    "Leave any field empty if the host gave nothing to base it on.",
  ].join("\n");
  return { system: SYSTEM, prompt };
}

const SLOT_BRIEF: Record<AiStringSlot, string> = {
  heroHeadline: "a short, evocative home hero headline (≤ 8 words)",
  heroSubheadline: "one warm supporting line under the hero headline",
  aboutStory: "the About-page story (2–4 sentences)",
  hostBioBody: "a few warm lines introducing the host or team",
  experiencesIntro: "one line framing what there is to do nearby",
};

/** Build a single-slot regeneration prompt (Haiku). */
export function buildSlotRegenPrompt(
  slot: AiStringSlot,
  ctx: SiteContext,
  answers: SiteAnswers,
): { system: string; prompt: string } {
  const prompt = [
    `Rewrite just ${SLOT_BRIEF[slot]} for this accommodation business.`,
    "Give a fresh alternative in the same warm, concrete voice.",
    "",
    "ACCOUNT CONTEXT",
    contextBlock(ctx),
    "",
    "THE HOST'S ANSWERS",
    answersBlock(answers),
    "",
    'Return it via the tool as the "value" field.',
  ].join("\n");
  return { system: SYSTEM, prompt };
}
