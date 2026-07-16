import { describe, it, expect } from "vitest";

import { hydratePageDoc } from "./hydrateProfile";
import { flatSectionsToPageDoc } from "./blueprints";
import { pageDocLeaves, type PageDoc } from "./pageDoc.schema";
import { newSection } from "./sectionDefaults";
import type { WebsiteSection } from "./sections.schema";
import type { ContentProfile, DerivedContent } from "./contentProfile.schema";

// Build a page from theme-style sections (each carries its own DEMO props, exactly
// like a theme blueprint does).
function page(types: WebsiteSection["type"][]): PageDoc {
  return flatSectionsToPageDoc(types.map((t) => newSection(t)));
}

function prop(doc: PageDoc, type: string, key: string): unknown {
  return pageDocLeaves(doc).find((l) => l.type === type)?.props[key];
}

describe("hydratePageDoc", () => {
  it("leaves the theme's demo copy untouched for an empty profile", () => {
    const doc = page(["hero", "intro"]);
    const out = hydratePageDoc(doc, "home", {});
    // newSection defaults are the demo copy.
    expect(prop(out, "hero", "headline")).toBe("Your headline here");
    expect(prop(out, "intro", "body")).toBe(
      "Tell guests what makes your place special.",
    );
  });

  it("overwrites a bound prop with the profile value", () => {
    const doc = page(["hero", "intro"]);
    const profile: ContentProfile = {
      home: { hero: { headline: "Wake up to the ocean" } },
    };
    const out = hydratePageDoc(doc, "home", profile);
    expect(prop(out, "hero", "headline")).toBe("Wake up to the ocean");
    // Untouched slot keeps the demo copy.
    expect(prop(out, "hero", "subheadline")).toBe(
      "A short welcoming line beneath it.",
    );
  });

  it("falls back to brand.tagline for the hero subheadline", () => {
    const doc = page(["hero"]);
    const out = hydratePageDoc(doc, "home", {
      brand: { tagline: "Barefoot luxury on the Atlantic" },
    });
    expect(prop(out, "hero", "subheadline")).toBe(
      "Barefoot luxury on the Atlantic",
    );
  });

  it("uses derived account content when the profile slot is empty", () => {
    const doc = page(["hero", "intro"]);
    const derived: DerivedContent = {
      propertyDescription: "A restored beach house steps from the sand.",
    };
    const out = hydratePageDoc(doc, "home", {}, derived);
    expect(prop(out, "intro", "body")).toBe(
      "A restored beach house steps from the sand.",
    );
  });

  it("prefers the profile value over the derived fallback", () => {
    const doc = page(["intro"]);
    const out = hydratePageDoc(
      doc,
      "home",
      { home: { intro: { body: "Host-written welcome." } } },
      { propertyDescription: "Auto-derived description." },
    );
    expect(prop(out, "intro", "body")).toBe("Host-written welcome.");
  });

  it("binds the About story + derives host name/photo", () => {
    const doc = page(["intro", "host_bio"]);
    const out = hydratePageDoc(
      doc,
      "about",
      {
        about: {
          story: "We opened in 2018.",
          hostBio: { body: "Hi, I'm Sam." },
        },
      },
      { hostName: "Sam Dlamini", hostPhotoPath: "hosts/sam.jpg" },
    );
    expect(prop(out, "intro", "body")).toBe("We opened in 2018.");
    expect(prop(out, "host_bio", "body")).toBe("Hi, I'm Sam.");
    expect(prop(out, "host_bio", "name")).toBe("Sam Dlamini");
    expect(prop(out, "host_bio", "photo_path")).toBe("hosts/sam.jpg");
  });

  it("maps experiences items into highlights props", () => {
    const doc = page(["intro", "highlights"]);
    const out = hydratePageDoc(doc, "experiences", {
      experiences: {
        intro: "Things to do nearby.",
        items: [
          { title: "Surf lessons", body: "Daily at dawn.", icon: "🌊" },
          { title: "Wine tasting", imagePath: "img/wine.jpg" },
        ],
      },
    });
    expect(prop(out, "intro", "body")).toBe("Things to do nearby.");
    const items = prop(out, "highlights", "items") as Array<
      Record<string, unknown>
    >;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "Surf lessons",
      body: "Daily at dawn.",
      icon: "🌊",
    });
    expect(items[1]).toMatchObject({
      title: "Wine tasting",
      image_path: "img/wine.jpg",
    });
  });

  it("derives contact FAQ from policies when no profile FAQ is set", () => {
    const doc = page(["faq"]);
    const out = hydratePageDoc(
      doc,
      "contact",
      {},
      { policiesFaq: [{ q: "Check-in time?", a: "From 14:00." }] },
    );
    const items = prop(out, "faq", "items") as Array<Record<string, unknown>>;
    expect(items).toEqual([{ q: "Check-in time?", a: "From 14:00." }]);
  });

  it("does nothing when no bindings apply to the page kind", () => {
    const doc = page(["hero", "intro"]);
    const before = JSON.stringify(doc);
    const out = hydratePageDoc(doc, "rooms", {
      home: { hero: { headline: "ignored" } },
    });
    expect(JSON.stringify(out)).toBe(before);
  });

  it("never mutates the input document", () => {
    const doc = page(["hero"]);
    const snapshot = JSON.stringify(doc);
    hydratePageDoc(doc, "home", { home: { hero: { headline: "Changed" } } });
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
