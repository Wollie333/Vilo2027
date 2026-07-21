import { describe, it, expect } from "vitest";

import {
  AI_SLOT_CHAR_LIMITS,
  aiContentSchema,
  aiContentToProfile,
  clampCopy,
  clampSlot,
  mergeContentProfile,
  stringSlotToProfile,
} from "./aiContent";
import type { ContentProfile } from "./contentProfile.schema";

describe("aiContentSchema", () => {
  it("accepts a partial result and rejects an over-long headline", () => {
    expect(
      aiContentSchema.safeParse({ heroHeadline: "Wake up to the sea" }).success,
    ).toBe(true);
    expect(
      aiContentSchema.safeParse({ heroHeadline: "x".repeat(201) }).success,
    ).toBe(false);
  });
});

describe("clampCopy", () => {
  it("leaves copy within the cap untouched (trimmed)", () => {
    expect(clampCopy("  Short and sweet  ", 64)).toBe("Short and sweet");
  });
  it("never exceeds the cap and never cuts mid-word", () => {
    const long =
      "Wake to the sound of the river and nothing else at all this fine morning";
    const out = clampCopy(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(long.startsWith(out)).toBe(true); // a clean prefix, no mangled word
    expect(out.endsWith(" ")).toBe(false);
  });
  it("prefers a sentence boundary for longer prose", () => {
    const story =
      "You have been meaning to slow down for months. This is the place that finally lets you do it in full.";
    expect(clampCopy(story, 70)).toBe(
      "You have been meaning to slow down for months.",
    );
  });
  it("strips dangling punctuation when it falls back to a word cut", () => {
    expect(
      /[\s,;:.!?–—-]$/u.test(clampCopy("one, two, three, four, five", 12)),
    ).toBe(false);
  });
});

describe("clampSlot", () => {
  it("hard-caps the hero headline + subheadline to their compact limits", () => {
    const headline = clampSlot("heroHeadline", "word ".repeat(40));
    const sub = clampSlot("heroSubheadline", "word ".repeat(60));
    expect(headline.length).toBeLessThanOrEqual(
      AI_SLOT_CHAR_LIMITS.heroHeadline,
    );
    expect(sub.length).toBeLessThanOrEqual(AI_SLOT_CHAR_LIMITS.heroSubheadline);
  });
});

describe("aiContentToProfile clamps", () => {
  it("truncates an over-long hero headline into the profile", () => {
    const profile = aiContentToProfile({
      heroHeadline: "brilliant ".repeat(20),
    });
    expect(profile.home?.hero?.headline?.length).toBeLessThanOrEqual(
      AI_SLOT_CHAR_LIMITS.heroHeadline,
    );
  });
});

describe("aiContentToProfile", () => {
  it("maps the flat AI result into canonical slots", () => {
    const profile = aiContentToProfile({
      heroHeadline: "Wake up to the sea",
      heroSubheadline: "Barefoot luxury on the Atlantic",
      aboutStory: "We opened in 2018.",
      hostBioBody: "Hi, I'm Sam.",
      experiencesIntro: "Plenty to explore.",
      experiences: [{ title: "Surf", body: "At dawn.", icon: "🌊" }],
      faq: [{ q: "Wi-Fi?", a: "Yes, free." }],
    });
    expect(profile.home?.hero).toEqual({
      headline: "Wake up to the sea",
      subheadline: "Barefoot luxury on the Atlantic",
    });
    expect(profile.about).toEqual({
      story: "We opened in 2018.",
      hostBio: { body: "Hi, I'm Sam." },
    });
    expect(profile.experiences?.items?.[0]).toMatchObject({
      title: "Surf",
      icon: "🌊",
    });
    expect(profile.contact?.faq).toEqual([{ q: "Wi-Fi?", a: "Yes, free." }]);
  });

  it("omits empty branches so demo copy survives", () => {
    const profile = aiContentToProfile({ heroHeadline: "Only this" });
    expect(profile.home?.hero).toEqual({ headline: "Only this" });
    expect(profile.about).toBeUndefined();
    expect(profile.experiences).toBeUndefined();
    expect(profile.contact).toBeUndefined();
  });
});

describe("stringSlotToProfile", () => {
  it("builds a nested patch for a single slot", () => {
    expect(stringSlotToProfile("heroHeadline", "New")).toEqual({
      home: { hero: { headline: "New" } },
    });
    expect(stringSlotToProfile("aboutStory", "Story")).toEqual({
      about: { story: "Story" },
    });
  });
});

describe("mergeContentProfile", () => {
  it("deep-merges nested objects without wiping siblings", () => {
    const base: ContentProfile = {
      home: { hero: { headline: "H", subheadline: "S" } },
      about: { story: "old" },
    };
    const patch: ContentProfile = { home: { hero: { headline: "H2" } } };
    const merged = mergeContentProfile(base, patch);
    expect(merged.home?.hero).toEqual({ headline: "H2", subheadline: "S" });
    expect(merged.about).toEqual({ story: "old" });
  });

  it("replaces arrays wholesale", () => {
    const base: ContentProfile = { contact: { faq: [{ q: "a", a: "1" }] } };
    const patch: ContentProfile = { contact: { faq: [{ q: "b", a: "2" }] } };
    expect(mergeContentProfile(base, patch).contact?.faq).toEqual([
      { q: "b", a: "2" },
    ]);
  });
});
