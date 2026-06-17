import { describe, expect, it } from "vitest";

import { classifyHost, isSeoFile, siteRewritePath } from "./host";

const ROOT = "vilo.site";

describe("classifyHost — app-domain routing is unchanged", () => {
  // THE critical guard: every app hostname must classify as "app" so the
  // existing next-intl + Supabase session pipeline runs untouched.
  it("keeps the app domains on the app branch", () => {
    for (const h of [
      "vilo.site",
      "www.vilo.site",
      "app.vilo.site",
      "VILO.SITE",
      "vilo.site:443",
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "0.0.0.0",
      "vilo-git-main-team.vercel.app",
      "my-deploy.vercel.app",
    ]) {
      expect(classifyHost(h, ROOT)).toEqual({ kind: "app" });
    }
  });

  it("treats reserved + locale subdomains as app (never a tenant)", () => {
    for (const sub of [
      "app",
      "api",
      "admin",
      "blog",
      "help",
      "cdn",
      "en",
      "af",
      "pt",
    ]) {
      expect(classifyHost(`${sub}.vilo.site`, ROOT)).toEqual({ kind: "app" });
    }
  });

  it("is fully app when NO root domain is configured (feature opt-in)", () => {
    for (const h of [
      "anything.com",
      "sub.vilo.site",
      "foo.localhost",
      "x.vilo.site",
    ]) {
      expect(classifyHost(h, undefined).kind).toBe("app");
      expect(classifyHost(h, "").kind).toBe("app");
    }
  });

  it("treats multi-level subdomains as app", () => {
    expect(classifyHost("a.b.vilo.site", ROOT).kind).toBe("app");
  });

  it("returns app for empty/missing host", () => {
    expect(classifyHost(null, ROOT).kind).toBe("app");
    expect(classifyHost("", ROOT).kind).toBe("app");
  });
});

describe("classifyHost — tenant routing", () => {
  it("routes tenant subdomains, normalising case + port", () => {
    expect(classifyHost("stillwater.vilo.site", ROOT)).toEqual({
      kind: "site",
      ref: "stillwater",
    });
    expect(classifyHost("Stillwater.Vilo.Site:443", ROOT)).toEqual({
      kind: "site",
      ref: "stillwater",
    });
  });

  it("routes connected custom domains by full host", () => {
    expect(classifyHost("www.cottage.co.za", ROOT)).toEqual({
      kind: "site",
      ref: "www.cottage.co.za",
    });
    expect(classifyHost("cottage.co.za", ROOT)).toEqual({
      kind: "site",
      ref: "cottage.co.za",
    });
  });

  it("supports foo.localhost dev subdomains", () => {
    expect(classifyHost("foo.localhost:3000", ROOT)).toEqual({
      kind: "site",
      ref: "foo",
    });
  });
});

describe("siteRewritePath", () => {
  it("maps home + paths under /{locale}/site", () => {
    expect(siteRewritePath("/", "en")).toBe("/en/site");
    expect(siteRewritePath("/about", "en")).toBe("/en/site/about");
    expect(siteRewritePath("/blog/my-post", "en")).toBe(
      "/en/site/blog/my-post",
    );
    expect(siteRewritePath("/sitemap.xml", "en")).toBe("/en/site/sitemap.xml");
  });
});

describe("isSeoFile", () => {
  it("matches only the bare-host SEO files", () => {
    expect(isSeoFile("/sitemap.xml")).toBe(true);
    expect(isSeoFile("/robots.txt")).toBe(true);
    expect(isSeoFile("/about")).toBe(false);
    expect(isSeoFile("/")).toBe(false);
  });
});
