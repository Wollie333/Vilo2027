import { describe, it, expect } from "vitest";

import {
  aiContentSchema,
  aiContentToProfile,
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
