// Image-performance readiness score (Phase 7c). A lab/readiness signal — NOT
// field Core Web Vitals (real RUM is a later add). It grades how well a site's
// media library is set up to load fast: every site image now ships responsively
// in a modern format through the Supabase transform pipeline (always-on), and
// we additionally reward alt text (SEO/a11y) and known dimensions (no layout
// shift → better CLS). Mirrors the seo/a11y coach pattern: a pure function over
// pre-counted inputs, so it has no DB/Storage dependency.

export type PerfStatus = "good" | "warn";

export type PerfCheck = {
  /** i18n key under `website.perf*` (good/warn variants). */
  key: string;
  status: PerfStatus;
  /** Affected image count for the `{count}` placeholder (warn rows). */
  count?: number;
};

export type PerfScore = {
  /** 0–100 readiness score. */
  score: number;
  grade: "good" | "fair" | "poor";
  checks: PerfCheck[];
  /** Total images considered (media-library assets). */
  imageCount: number;
};

export type PerfInput = {
  totalImages: number;
  withAlt: number;
  withDims: number;
};

export function analyzeSitePerformance(input: PerfInput): PerfScore {
  const total = Math.max(0, input.totalImages);
  const checks: PerfCheck[] = [
    // Always true now — the public site serves every image resized + WebP/AVIF.
    { key: "perfResponsive", status: "good" },
  ];

  let score = 100;
  if (total > 0) {
    const altMissing = Math.max(0, total - input.withAlt);
    const dimsMissing = Math.max(0, total - input.withDims);
    score -= Math.round((altMissing / total) * 40);
    score -= Math.round((dimsMissing / total) * 30);

    checks.push({
      key: altMissing === 0 ? "perfAltGood" : "perfAltWarn",
      status: altMissing === 0 ? "good" : "warn",
      count: altMissing,
    });
    checks.push({
      key: dimsMissing === 0 ? "perfDimsGood" : "perfDimsWarn",
      status: dimsMissing === 0 ? "good" : "warn",
      count: dimsMissing,
    });
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "good" : score >= 70 ? "fair" : "poor";
  return { score, grade, checks, imageCount: total };
}
