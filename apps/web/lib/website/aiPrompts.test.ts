import { describe, it, expect } from "vitest";

import { buildSiteContentPrompt, buildSlotRegenPrompt } from "./aiPrompts";

const CTX = {
  businessName: "Klein Cottage",
  tagline: "Sea-facing calm",
  hostName: "Sam Dlamini",
};
const ANSWERS = {
  special: "A restored beach house steps from the sand",
  story: "We restored my grandmother's cottage",
  thingsToDo: ["Surf lessons", "Wine tasting"],
};

describe("buildSiteContentPrompt", () => {
  it("embeds the business context and the host's answers", () => {
    const { system, prompt } = buildSiteContentPrompt(CTX, ANSWERS);
    expect(system).toMatch(/never invent/i);
    expect(prompt).toContain("Klein Cottage");
    expect(prompt).toContain("Sam Dlamini");
    expect(prompt).toContain("A restored beach house steps from the sand");
    expect(prompt).toContain("Surf lessons; Wine tasting");
    expect(prompt).toContain("heroHeadline");
  });

  it("marks missing answers rather than fabricating them", () => {
    const { prompt } = buildSiteContentPrompt(
      { businessName: "Solo Stay" },
      {},
    );
    expect(prompt).toContain("(not provided)");
  });
});

describe("buildSlotRegenPrompt", () => {
  it("targets a single slot with the shared voice + context", () => {
    const { prompt } = buildSlotRegenPrompt("heroHeadline", CTX, ANSWERS);
    expect(prompt).toMatch(/headline/i);
    expect(prompt).toContain("Klein Cottage");
    expect(prompt).toContain('"value"');
  });
});
