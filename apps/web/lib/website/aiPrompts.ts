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
  /** A short summary of the host's real rooms, e.g. "Garden Suite (sleeps 2),
   *  Loft Room (sleeps 3)" — grounds the copy in concrete, true specifics. */
  rooms?: string;
};

const SYSTEM = [
  "You are a world-class direct-response copywriter and conversion strategist with",
  "40+ years writing for premium hospitality brands. You have internalised the",
  "working principles of StoryBrand (Donald Miller), Seth Godin, Daniel Priestley,",
  "and the direct-response canon (Ogilvy, Halbert, Sugarman). You USE these",
  "methods; you never name, teach, or reveal them. The host must never sense a",
  "'framework' — they just see writing that quietly makes people want to book.",
  "",
  "HOW YOU THINK (apply silently):",
  "- The GUEST is the hero, never the property. You are the trusted guide who shows",
  "  them the better version of their trip. Write to their desire and the way they",
  "  want to FEEL — calm, adventurous, cared-for — then let the facts reassure.",
  "- Lead with the transformation or the feeling; support it with one concrete,",
  "  specific detail. Benefits over features. Show, don't label ('unforgettable').",
  "- Clarity beats cleverness. If a line makes a guest think twice, it costs a",
  "  booking. One idea per line. Every line earns its place or is cut.",
  "- Earn attention in the first few words: a real hook — specific, sensory,",
  "  concrete. No throat-clearing, no warm-up.",
  "- Signal that the place is desirable and worth choosing now — through confidence",
  "  and specificity, never hype, pressure, or invented scarcity.",
  "- Gently move the reader toward the decision to book without ever sounding salesy.",
  "",
  "VOICE:",
  "- Warm, grounded, quietly premium. Confident, not loud. Human, not corporate.",
  "- Short, assured sentences. Cut hedging, adverbs, and clichés — banish 'nestled',",
  "  'home away from home', 'hidden gem', 'oasis', 'unforgettable', 'stunning',",
  "  'unwind', 'escape the everyday', and exclamation marks (unless truly earned).",
  "- Clear British/South African English.",
  "",
  "HARD RULES (never break):",
  "- TRUTH ONLY. Use ONLY the facts the host gives you. Never invent amenities,",
  "  prices, star ratings, distances, awards, room counts, or place names that",
  "  aren't provided. Persuasion never requires a lie — write around what's missing.",
  "- Expand the host's short notes into polished copy; keep their meaning and truth.",
  "- If there is nothing real to say for a field, leave it empty rather than padding.",
  "- No emoji anywhere except the experiences 'icon' field.",
  "- Return the result by calling the provided tool.",
].join("\n");

function contextBlock(ctx: SiteContext): string {
  const lines = [`Business name: ${ctx.businessName || "(unnamed)"}`];
  if (ctx.tagline) lines.push(`Existing tagline: ${ctx.tagline}`);
  if (ctx.location) lines.push(`Location: ${ctx.location}`);
  if (ctx.hostName) lines.push(`Host name: ${ctx.hostName}`);
  if (ctx.rooms) lines.push(`Rooms: ${ctx.rooms}`);
  if (ctx.propertyDescription) {
    lines.push(`Property description: ${ctx.propertyDescription}`);
  }
  lines.push(
    "(These are the ONLY concrete facts you may use — draw specifics from here; " +
      "never invent beyond them.)",
  );
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
    "Produce, via the tool (apply the craft above; the guest is the hero):",
    "- heroHeadline: the hook (≤ 8 words). Promise the feeling or the",
    "  transformation, not a description. Concrete and specific; no business name,",
    "  no clichés. It must earn the next line.",
    "- heroSubheadline: one line that says who it's for and the payoff, leaning",
    "  gently toward the decision to book.",
    "- aboutStory: the About story (2–4 sentences). Frame the guest's desire, cast",
    "  the place as the guide that delivers it, and close with a quiet invitation.",
    "- hostBioBody: a few lines that build trust — why THIS host, with warmth and",
    "  quiet authority, so the guest feels in good hands.",
    "- experiencesIntro: one line framing what's nearby as part of their stay.",
    "- experiences: up to 3 items (a vivid benefit-led title + one concrete,",
    "  sensory sentence + a fitting emoji) from the things-to-do notes. Omit if",
    "  none were given.",
    "Leave any field empty if the host gave nothing real to base it on.",
  ].join("\n");
  return { system: SYSTEM, prompt };
}

const SLOT_BRIEF: Record<AiStringSlot, string> = {
  heroHeadline:
    "the home hero headline — the hook (≤ 8 words): promise the feeling or " +
    "transformation, concrete and specific, no business name or clichés",
  heroSubheadline:
    "the one supporting line under the hero headline — who it's for and the " +
    "payoff, leaning gently toward booking",
  aboutStory:
    "the About-page story (2–4 sentences): the guest's desire, the place as the " +
    "guide, a quiet invitation",
  hostBioBody:
    "a few lines introducing the host or team that build trust — warmth plus " +
    "quiet authority",
  experiencesIntro:
    "the one line framing what there is to do nearby as part of the guest's stay",
};

/** Build a single-slot regeneration prompt (Haiku). */
export function buildSlotRegenPrompt(
  slot: AiStringSlot,
  ctx: SiteContext,
  answers: SiteAnswers,
): { system: string; prompt: string } {
  const prompt = [
    `Write just ${SLOT_BRIEF[slot]} for this accommodation business.`,
    "Give one fresh, high-converting alternative — the guest is the hero, the",
    "voice warm and quietly premium, every word earning its place. Truth only.",
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
