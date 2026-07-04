import { describe, expect, it } from "vitest";

import { toBackgroundEmbed, toEmbed } from "./videoEmbed";

describe("toEmbed", () => {
  it("converts YouTube share/short/youtu.be links", () => {
    expect(toEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(toEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });
  it("converts Vimeo links", () => {
    expect(toEmbed("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });
  it("passes an existing embed URL through, else null", () => {
    expect(toEmbed("https://www.youtube.com/embed/abc")).toBe(
      "https://www.youtube.com/embed/abc",
    );
    expect(toEmbed("https://example.com/not-a-video")).toBeNull();
    expect(toEmbed("")).toBeNull();
  });
});

describe("toBackgroundEmbed", () => {
  it("YouTube gets autoplay/mute/loop/playlist + no chrome", () => {
    const u = toBackgroundEmbed("https://youtu.be/dQw4w9WgXcQ")!;
    expect(u).toContain("/embed/dQw4w9WgXcQ");
    expect(u).toContain("autoplay=1");
    expect(u).toContain("mute=1");
    expect(u).toContain("loop=1");
    expect(u).toContain("playlist=dQw4w9WgXcQ");
    expect(u).toContain("controls=0");
  });
  it("Vimeo uses background=1", () => {
    expect(toBackgroundEmbed("https://vimeo.com/123")).toBe(
      "https://player.vimeo.com/video/123?background=1&autoplay=1&muted=1&loop=1",
    );
  });
  it("returns null for non-video URLs", () => {
    expect(toBackgroundEmbed("https://example.com")).toBeNull();
  });
});
