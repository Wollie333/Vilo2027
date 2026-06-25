import { describe, expect, it, vi } from "vitest";

// sanitiseHtml.ts is server-only (pulls in sanitize-html). Stub the marker so it
// imports under the node test environment.
vi.mock("server-only", () => ({}));

import { sanitiseListingHtml, stripHtml } from "./sanitiseHtml";

describe("sanitiseListingHtml", () => {
  it("keeps the formatting tags the editor produces", () => {
    const html =
      "<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>one</li></ul><blockquote>q</blockquote>";
    const out = sanitiseListingHtml(html);
    expect(out).toContain("<h2>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
    expect(out).toContain("<li>");
    expect(out).toContain("<blockquote>");
  });

  it("strips <script> and event handlers", () => {
    const out = sanitiseListingHtml(
      '<p onclick="evil()">hi</p><script>alert(1)</script>',
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).toContain("hi");
  });

  it("keeps http(s) links and forces a safe rel + target", () => {
    const out = sanitiseListingHtml(
      '<p><a href="https://example.com">visit</a></p>',
    );
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps mailto and tel links", () => {
    expect(sanitiseListingHtml('<a href="mailto:a@b.com">mail</a>')).toContain(
      "mailto:a@b.com",
    );
    expect(
      sanitiseListingHtml('<a href="tel:+27110000000">call</a>'),
    ).toContain("tel:+27110000000");
  });

  it("keeps relative + in-page anchor links", () => {
    expect(sanitiseListingHtml('<a href="/about">about</a>')).toContain(
      'href="/about"',
    );
    expect(sanitiseListingHtml('<a href="#book">book</a>')).toContain(
      'href="#book"',
    );
  });

  it("drops dangerous link schemes (javascript:/data:) but keeps the text", () => {
    const js = sanitiseListingHtml('<a href="javascript:alert(1)">x</a>');
    expect(js).not.toContain("javascript:");
    expect(js).toContain("x");

    const data = sanitiseListingHtml(
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    );
    expect(data).not.toContain("data:text/html");
  });

  it("only allows http(s) image sources", () => {
    expect(
      sanitiseListingHtml('<img src="https://cdn.test/x.jpg" alt="ok">'),
    ).toContain('src="https://cdn.test/x.jpg"');
    expect(
      sanitiseListingHtml('<img src="javascript:alert(1)" alt="bad">'),
    ).not.toContain("javascript:");
  });
});

describe("stripHtml", () => {
  it("removes all tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello   <strong>world</strong></p>")).toBe(
      "Hello world",
    );
  });
});
