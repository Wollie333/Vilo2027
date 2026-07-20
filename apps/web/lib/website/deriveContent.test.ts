import { describe, it, expect } from "vitest";

import { mergeDerivedProfile } from "./deriveContent";
import type { ContentProfile, DerivedContent } from "./contentProfile.schema";

const DERIVED: DerivedContent = {
  hostName: "Thandi Mokoena",
  hostPhotoPath: "https://cdn.example/host.jpg",
  propertyDescription: "A restored beach house steps from the sand.",
  heroPhotoPath: "https://cdn.example/hero.jpg",
  policiesFaq: [{ q: "What is your cancellation policy?", a: "Flexible." }],
};

describe("mergeDerivedProfile", () => {
  it("fills every empty derivable slot from the account fallback", () => {
    const out = mergeDerivedProfile({}, DERIVED);
    expect(out.home?.hero?.imagePath).toBe("https://cdn.example/hero.jpg");
    expect(out.home?.intro?.body).toBe(
      "A restored beach house steps from the sand.",
    );
    expect(out.about?.story).toBe(
      "A restored beach house steps from the sand.",
    );
    expect(out.about?.hostBio?.photoPath).toBe("https://cdn.example/host.jpg");
    expect(out.contact?.faq).toEqual(DERIVED.policiesFaq);
  });

  it("never overwrites a slot the host already filled", () => {
    const profile: ContentProfile = {
      home: {
        hero: { imagePath: "host/hero.png" },
        intro: { body: "My own welcome." },
      },
      about: {
        story: "My own story.",
        hostBio: { photoPath: "host/me.png" },
      },
      contact: { faq: [{ q: "Own Q", a: "Own A" }] },
    };
    const out = mergeDerivedProfile(profile, DERIVED);
    expect(out.home?.hero?.imagePath).toBe("host/hero.png");
    expect(out.home?.intro?.body).toBe("My own welcome.");
    expect(out.about?.story).toBe("My own story.");
    expect(out.about?.hostBio?.photoPath).toBe("host/me.png");
    expect(out.contact?.faq).toEqual([{ q: "Own Q", a: "Own A" }]);
  });

  it("treats blank strings and empty arrays as empty (fills them)", () => {
    const profile: ContentProfile = {
      about: { story: "   " },
      contact: { faq: [] },
    };
    const out = mergeDerivedProfile(profile, DERIVED);
    expect(out.about?.story).toBe(
      "A restored beach house steps from the sand.",
    );
    expect(out.contact?.faq).toEqual(DERIVED.policiesFaq);
  });

  it("leaves a slot untouched when no derived value is available", () => {
    const out = mergeDerivedProfile({}, {});
    expect(out.home?.hero?.imagePath).toBeUndefined();
    expect(out.about?.story).toBeUndefined();
    expect(out.contact?.faq).toBeUndefined();
  });

  it("does not mutate the input profile", () => {
    const profile: ContentProfile = { about: {} };
    const snapshot = JSON.stringify(profile);
    mergeDerivedProfile(profile, DERIVED);
    expect(JSON.stringify(profile)).toBe(snapshot);
  });

  it("preserves unrelated slots the host filled", () => {
    const profile: ContentProfile = {
      home: { hero: { headline: "Wake up to the ocean" } },
    };
    const out = mergeDerivedProfile(profile, DERIVED);
    expect(out.home?.hero?.headline).toBe("Wake up to the ocean");
    // …and still fills the empty image slot alongside it.
    expect(out.home?.hero?.imagePath).toBe("https://cdn.example/hero.jpg");
  });
});
