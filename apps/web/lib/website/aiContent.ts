// AI content — the flat shape the model fills, and its mapping into the
// Content Profile. Wizard arc slice 3.
//
// The model is asked for a FLAT object (easier for it to fill reliably) via a
// forced tool call; `aiContentJsonSchema` is that tool's input_schema and
// `aiContentSchema` validates the result. `aiContentToProfile` maps the flat
// result into the canonical ContentProfile slots (contentProfile.schema.ts).
import { z } from "zod";

import type { ContentProfile } from "./contentProfile.schema";

export const aiContentSchema = z.object({
  heroHeadline: z.string().max(200).optional(),
  heroSubheadline: z.string().max(400).optional(),
  aboutStory: z.string().max(4000).optional(),
  hostBioBody: z.string().max(4000).optional(),
  experiencesIntro: z.string().max(4000).optional(),
  experiences: z
    .array(
      z.object({
        title: z.string().max(120),
        body: z.string().max(600).optional(),
        icon: z.string().max(60).optional(),
      }),
    )
    .max(3)
    .optional(),
  faq: z
    .array(z.object({ q: z.string().max(300), a: z.string().max(2000) }))
    .max(6)
    .optional(),
});

export type AiContent = z.infer<typeof aiContentSchema>;

/** JSON Schema handed to the Anthropic tool (mirrors aiContentSchema). Kept in
 *  sync by the aiContent tests. */
export const aiContentJsonSchema = {
  type: "object",
  properties: {
    heroHeadline: {
      type: "string",
      description: "Home hero headline — short, evocative, ≤ 8 words.",
    },
    heroSubheadline: {
      type: "string",
      description: "One warm supporting line under the hero headline.",
    },
    aboutStory: {
      type: "string",
      description:
        "The About-page story: who you are and why you host, 2–4 sentences.",
    },
    hostBioBody: {
      type: "string",
      description: "A few warm lines introducing the host or team.",
    },
    experiencesIntro: {
      type: "string",
      description: "One or two lines framing what there is to do nearby.",
    },
    experiences: {
      type: "array",
      maxItems: 3,
      description: "Up to three things guests love to do nearby.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short title for the activity.",
          },
          body: {
            type: "string",
            description: "One-sentence description of the activity.",
          },
          icon: {
            type: "string",
            description: "A single relevant emoji for the activity.",
          },
        },
        required: ["title"],
      },
    },
    faq: {
      type: "array",
      maxItems: 6,
      description: "Guest FAQs with concise answers.",
      items: {
        type: "object",
        properties: {
          q: { type: "string", description: "The question." },
          a: { type: "string", description: "A concise, factual answer." },
        },
        required: ["q", "a"],
      },
    },
  },
} as const;

/** The single-string AI slots that can be regenerated on their own. */
export const AI_STRING_SLOTS = [
  "heroHeadline",
  "heroSubheadline",
  "aboutStory",
  "hostBioBody",
  "experiencesIntro",
] as const;
export type AiStringSlot = (typeof AI_STRING_SLOTS)[number];

/** Map the flat AI result into the canonical ContentProfile slots. Omits empty
 *  branches so hydration keeps the theme's demo copy where the model said nothing. */
export function aiContentToProfile(ai: AiContent): ContentProfile {
  const profile: ContentProfile = {};

  const hero: NonNullable<NonNullable<ContentProfile["home"]>["hero"]> = {};
  if (ai.heroHeadline) hero.headline = ai.heroHeadline;
  if (ai.heroSubheadline) hero.subheadline = ai.heroSubheadline;
  if (Object.keys(hero).length) profile.home = { hero };

  const about: NonNullable<ContentProfile["about"]> = {};
  if (ai.aboutStory) about.story = ai.aboutStory;
  if (ai.hostBioBody) about.hostBio = { body: ai.hostBioBody };
  if (Object.keys(about).length) profile.about = about;

  const experiences: NonNullable<ContentProfile["experiences"]> = {};
  if (ai.experiencesIntro) experiences.intro = ai.experiencesIntro;
  if (ai.experiences?.length) {
    experiences.items = ai.experiences.map((e) => ({
      title: e.title,
      body: e.body,
      icon: e.icon,
    }));
  }
  if (Object.keys(experiences).length) profile.experiences = experiences;

  if (ai.faq?.length) profile.contact = { faq: ai.faq };

  return profile;
}

/** Map a single-string AI slot to its ContentProfile patch. */
export function stringSlotToProfile(
  slot: AiStringSlot,
  value: string,
): ContentProfile {
  switch (slot) {
    case "heroHeadline":
      return { home: { hero: { headline: value } } };
    case "heroSubheadline":
      return { home: { hero: { subheadline: value } } };
    case "aboutStory":
      return { about: { story: value } };
    case "hostBioBody":
      return { about: { hostBio: { body: value } } };
    case "experiencesIntro":
      return { experiences: { intro: value } };
  }
}

type Plain = Record<string, unknown>;

function isPlainObject(v: unknown): v is Plain {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge(a: Plain, b: Plain): Plain {
  const out: Plain = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    const cur = out[k];
    // Recurse into nested plain objects; arrays + scalars replace wholesale.
    out[k] = isPlainObject(v) && isPlainObject(cur) ? deepMerge(cur, v) : v;
  }
  return out;
}

/** Deep-merge a patch over a base profile: nested objects merge, arrays/scalars
 *  replace. Used to fold AI output (or a single regenerated slot) into the
 *  host's existing Content Profile without wiping untouched slots. */
export function mergeContentProfile(
  base: ContentProfile,
  patch: ContentProfile,
): ContentProfile {
  return deepMerge(base as Plain, patch as Plain) as ContentProfile;
}
