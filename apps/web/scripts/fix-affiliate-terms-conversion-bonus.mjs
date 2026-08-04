// One-off: bring the live Affiliate Program Terms into line with the SoT
// (WIELO_FOUNDING_PROGRAMME.md) — which has NO conversion bonus. The published
// terms doc still promised "conversion bonuses"; this removes that promise the
// same versioned way saveLegalDocumentAction does (bump version + snapshot the
// history row + advance published_at), so partners re-accept the corrected text.
//
// Idempotent: if no "conversion bonus" wording remains, it reports and exits
// without writing. Prints the before/after snippet so the change is verifiable.
//
//   node --env-file=.env.local scripts/fix-affiliate-terms-conversion-bonus.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error(
    "Run from apps/web with: node --env-file=.env.local scripts/fix-affiliate-terms-conversion-bonus.mjs",
  );
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SLUG = "affiliate-program-terms";

// Ordered, most-specific first. The first phrase found is replaced; each keeps
// the sentence grammatical. Case-insensitive on the enumerations.
const REPLACEMENTS = [
  [
    /leaderboards,\s*ladders,\s*conversion bonuses,?\s*and\s*prize pots/gi,
    "leaderboards, commission structures and cash prize pots",
  ],
  [
    /leaderboards,\s*ladders,?\s*and\s*conversion bonuses/gi,
    "leaderboards and commission structures",
  ],
  [/,?\s*ladders,\s*conversion bonuses/gi, ", commission structures"],
  [/,?\s*and\s*conversion bonuses/gi, ""],
  [/conversion bonuses,?\s*and\s*/gi, ""],
  [/,?\s*conversion bonuses/gi, ""],
  [/conversion bonus(es)?/gi, "cash prizes"], // last-resort catch-all
];

const snippet = (html, term = "conversion") => {
  if (!html) return "(empty)";
  const i = html.toLowerCase().indexOf(term);
  if (i === -1) return "(term not present)";
  return "…" + html.slice(Math.max(0, i - 140), i + 160) + "…";
};

const { data: doc, error: readErr } = await admin
  .from("legal_documents")
  .select("slug, title, body_html, version, is_published, published_at")
  .eq("slug", SLUG)
  .maybeSingle();

if (readErr) {
  console.error("Read failed:", readErr.message);
  process.exit(1);
}
if (!doc) {
  console.error(`No legal_documents row for slug "${SLUG}".`);
  process.exit(1);
}

const before = doc.body_html ?? "";
if (!/conversion bonus/i.test(before)) {
  console.log(`✓ "${SLUG}" already has no conversion-bonus wording — nothing to do.`);
  process.exit(0);
}

console.log("BEFORE:", snippet(before));

let after = before;
for (const [re, to] of REPLACEMENTS) {
  if (re.test(after)) after = after.replace(re, to);
}
// Tidy any doubled spaces/commas the removals may leave.
after = after.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",");

if (after === before) {
  console.error("No replacement matched — aborting so nothing is written blind.");
  process.exit(1);
}
if (/conversion bonus/i.test(after)) {
  console.error("Some 'conversion bonus' wording survived — aborting for manual review.");
  console.error("AFTER:", snippet(after));
  process.exit(1);
}

console.log("AFTER: ", snippet(after, "commission") === "(term not present)"
  ? snippet(after, "prize")
  : snippet(after, "commission"));

// Mirror saveLegalDocumentAction: body changed → version + 1; advance
// published_at when published.
const prevVersion = typeof doc.version === "number" ? doc.version : 0;
const version = prevVersion + 1;
const nowIso = new Date().toISOString();
const publishedAt = doc.is_published ? nowIso : (doc.published_at ?? null);

const { error: upErr } = await admin.from("legal_documents").upsert(
  {
    slug: SLUG,
    title: doc.title,
    body_html: after,
    version,
    is_published: doc.is_published,
    published_at: publishedAt,
    updated_at: nowIso,
  },
  { onConflict: "slug" },
);
if (upErr) {
  console.error("Update failed:", upErr.message);
  process.exit(1);
}

const { error: verErr } = await admin.from("legal_document_versions").upsert(
  { slug: SLUG, version, title: doc.title, body_html: after, published_at: publishedAt },
  { onConflict: "slug,version" },
);
if (verErr) {
  console.error("History snapshot failed:", verErr.message);
  process.exit(1);
}

console.log(
  `✓ Updated "${SLUG}" v${prevVersion} → v${version}${doc.is_published ? " (published; partners re-accept the corrected text)" : " (draft)"}.`,
);
