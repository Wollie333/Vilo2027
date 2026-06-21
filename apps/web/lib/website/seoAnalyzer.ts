// Lightweight, framework-agnostic SEO + readability analyzer (Phase 3). Pure and
// client-safe so the editor can score live as the host types. Tailored to the
// accommodation CMS rather than pulling in the heavy `yoastseo` package; the
// readability checks are deliberately language-neutral (lengths, not English
// grammar) for the EN/AF/DE market.
import { slugify } from "@/lib/help/slug";

import type { WebsiteSection } from "./sections.schema";

export type SeoStatus = "good" | "ok" | "bad";
export type SeoCheck = { id: string; status: SeoStatus; label: string };
export type SeoScore = "red" | "orange" | "green";
export type SeoReport = {
  score: SeoScore;
  percent: number;
  checks: SeoCheck[];
  readability: SeoCheck[];
};

export type SeoInput = {
  title?: string;
  description?: string;
  focusKeyword?: string;
  bodyText?: string;
  slug?: string;
};

const TEXT_KEYS = new Set([
  "heading",
  "headline",
  "subheadline",
  "body",
  "name",
  "title",
  "label",
  "value",
  "q",
  "a",
  "note",
  "caption",
  "html",
  "intro",
  "excerpt",
  "blurb",
  // Free-element text props.
  "text",
  "alt",
]);

function walk(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const n of node) walk(n, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string") {
        if (TEXT_KEYS.has(k)) out.push(v);
      } else {
        walk(v, out);
      }
    }
  }
}

/** Flatten a page's section content into plain analyzable text (HTML stripped). */
export function extractSectionsText(sections: WebsiteSection[]): string {
  const out: string[] = [];
  for (const s of sections) walk(s.props, out);
  return out
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function analyzeSeo(input: SeoInput): SeoReport {
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const kw = (input.focusKeyword ?? "").trim().toLowerCase();
  const body = (input.bodyText ?? "").trim();
  const bodyLower = body.toLowerCase();
  const slug = (input.slug ?? "").toLowerCase();
  const checks: SeoCheck[] = [];

  // Title
  checks.push(
    !title
      ? { id: "title", status: "bad", label: "Add an SEO title." }
      : title.length < 30
        ? {
            id: "title",
            status: "ok",
            label: "Title is short — aim for 30–60 characters.",
          }
        : title.length > 60
          ? {
              id: "title",
              status: "ok",
              label: "Title is long — aim for 30–60 characters.",
            }
          : { id: "title", status: "good", label: "Title length is ideal." },
  );

  // Meta description
  checks.push(
    !description
      ? { id: "desc", status: "bad", label: "Add a meta description." }
      : description.length < 120
        ? {
            id: "desc",
            status: "ok",
            label: "Description is short — aim for 120–156 characters.",
          }
        : description.length > 156
          ? {
              id: "desc",
              status: "ok",
              label: "Description is long — aim for 120–156 characters.",
            }
          : {
              id: "desc",
              status: "good",
              label: "Description length is ideal.",
            },
  );

  // Focus keyword
  if (!kw) {
    checks.push({
      id: "keyword",
      status: "ok",
      label: "Set a focus keyword to unlock keyword checks.",
    });
  } else {
    checks.push(
      title.toLowerCase().includes(kw)
        ? {
            id: "kwTitle",
            status: "good",
            label: "Focus keyword is in the title.",
          }
        : {
            id: "kwTitle",
            status: "bad",
            label: "Add the focus keyword to the title.",
          },
    );
    checks.push(
      description.toLowerCase().includes(kw)
        ? {
            id: "kwDesc",
            status: "good",
            label: "Focus keyword is in the description.",
          }
        : {
            id: "kwDesc",
            status: "ok",
            label: "Add the focus keyword to the description.",
          },
    );
    checks.push(
      slugify(kw).length > 0 && slug.includes(slugify(kw))
        ? {
            id: "kwSlug",
            status: "good",
            label: "Focus keyword is in the URL.",
          }
        : {
            id: "kwSlug",
            status: "ok",
            label: "Add the focus keyword to the page URL.",
          },
    );
    if (body) {
      checks.push(
        bodyLower.includes(kw)
          ? {
              id: "kwBody",
              status: "good",
              label: "Focus keyword appears in the content.",
            }
          : {
              id: "kwBody",
              status: "bad",
              label: "Use the focus keyword in your content.",
            },
      );
    }
  }

  // Content length
  const wc = wordCount(body);
  if (body) {
    checks.push(
      wc >= 120
        ? {
            id: "len",
            status: "good",
            label: `Good content length (${wc} words).`,
          }
        : wc >= 50
          ? {
              id: "len",
              status: "ok",
              label: `A little more content would help (${wc} words).`,
            }
          : {
              id: "len",
              status: "bad",
              label: `Content is thin (${wc} words).`,
            },
    );
  }

  // Readability (lite, language-neutral)
  const readability: SeoCheck[] = [];
  if (body) {
    const sentences = body
      .split(/[.!?]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const avg = sentences.length ? wc / sentences.length : wc;
    readability.push(
      avg <= 20
        ? {
            id: "sent",
            status: "good",
            label: "Sentence length is easy to read.",
          }
        : avg <= 28
          ? { id: "sent", status: "ok", label: "Some sentences are long." }
          : {
              id: "sent",
              status: "bad",
              label: "Sentences are long — break them up.",
            },
    );
    readability.push(
      wc >= 50
        ? { id: "depth", status: "good", label: "Enough content for readers." }
        : {
            id: "depth",
            status: "ok",
            label: "Add a little more content for readers.",
          },
    );
  } else {
    readability.push({
      id: "depth",
      status: "ok",
      label: "Add content to check readability.",
    });
  }

  const earned = checks.reduce(
    (a, c) => a + (c.status === "good" ? 2 : c.status === "ok" ? 1 : 0),
    0,
  );
  const percent = checks.length
    ? Math.round((earned / (checks.length * 2)) * 100)
    : 0;
  const score: SeoScore =
    percent >= 80 ? "green" : percent >= 50 ? "orange" : "red";

  return { score, percent, checks, readability };
}
