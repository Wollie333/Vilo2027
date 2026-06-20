// Lightweight accessibility checker for a page's curated sections (Phase 3).
// Pure + client-safe so the editor can score live. The section COMPONENTS are
// built accessible; what a host can still get wrong is structural — a missing
// heading, an image with nothing to derive alt text from, or vague button text.
// Those are exactly what this flags.
import type { WebsiteSection } from "./sections.schema";

export type A11yStatus = "good" | "ok" | "bad";
export type A11yCheck = { id: string; status: A11yStatus; label: string };
export type A11yScore = "red" | "orange" | "green";
export type A11yReport = {
  score: A11yScore;
  percent: number;
  checks: A11yCheck[];
};

const GENERIC_LABELS = new Set([
  "click here",
  "read more",
  "more",
  "here",
  "link",
  "this",
  "go",
]);
const IMAGE_KEYS = [
  "image_path",
  "imagePath",
  "hero_path",
  "heroImagePath",
  "background_path",
  "backgroundImagePath",
];
const TEXT_KEYS = ["heading", "headline", "caption", "alt", "title", "name"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function analyzeA11y(sections: WebsiteSection[]): A11yReport {
  const enabled = sections.filter((s) => s.enabled !== false);
  const checks: A11yCheck[] = [];

  // 1. Content present
  checks.push(
    enabled.length
      ? { id: "content", status: "good", label: "Page has content sections." }
      : { id: "content", status: "bad", label: "Add at least one section." },
  );

  // 2. Headings present (structure for screen readers)
  let headings = 0;
  for (const s of enabled) {
    const p = s.props as Record<string, unknown>;
    if (str(p.heading) || str(p.headline)) headings++;
  }
  checks.push(
    headings > 0
      ? {
          id: "heading",
          status: "good",
          label: "Page has headings for structure.",
        }
      : {
          id: "heading",
          status: "bad",
          label: "Add a heading so screen readers can navigate.",
        },
  );

  // 3. Leads with a clear title (h1 at the top)
  const first = enabled[0];
  const firstProps = (first?.props ?? {}) as Record<string, unknown>;
  const leadsWell =
    !!first &&
    (first.type === "hero" ||
      !!str(firstProps.heading) ||
      !!str(firstProps.headline));
  checks.push(
    leadsWell
      ? { id: "lead", status: "good", label: "Page leads with a clear title." }
      : {
          id: "lead",
          status: "ok",
          label: "Start the page with a hero or heading.",
        },
  );

  // 4. Descriptive button / link text
  const generic: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string") {
          if (/label/i.test(k) && GENERIC_LABELS.has(v.trim().toLowerCase())) {
            generic.push(v.trim());
          }
        } else {
          walk(v);
        }
      }
    }
  };
  for (const s of enabled) walk(s.props);
  checks.push(
    generic.length === 0
      ? {
          id: "linktext",
          status: "good",
          label: "Button labels are descriptive.",
        }
      : {
          id: "linktext",
          status: "ok",
          label: `Avoid vague button text (e.g. “${generic[0]}”).`,
        },
  );

  // 5. Images have something to derive alt text from
  let imagesMissingAlt = 0;
  for (const s of enabled) {
    const p = s.props as Record<string, unknown>;
    const hasImage = IMAGE_KEYS.some((k) => str(p[k]));
    const hasText = TEXT_KEYS.some((k) => str(p[k]));
    if (hasImage && !hasText) imagesMissingAlt++;
  }
  checks.push(
    imagesMissingAlt === 0
      ? { id: "alt", status: "good", label: "Images have descriptive text." }
      : {
          id: "alt",
          status: "ok",
          label: "Add headings/captions so images get alt text.",
        },
  );

  const earned = checks.reduce(
    (a, c) => a + (c.status === "good" ? 2 : c.status === "ok" ? 1 : 0),
    0,
  );
  const percent = checks.length
    ? Math.round((earned / (checks.length * 2)) * 100)
    : 0;
  const score: A11yScore =
    percent >= 80 ? "green" : percent >= 50 ? "orange" : "red";

  return { score, percent, checks };
}
