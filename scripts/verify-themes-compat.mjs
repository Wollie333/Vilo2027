// Theme ⇄ sections compatibility verifier — READ ONLY, service role.
// Runs every active theme's page_templates through the ACTUAL current
// sections.schema (parseSectionsLoose) and reports any section that would be
// DROPPED at render — i.e. a theme blueprint that no longer matches the section
// types/props we've been building. This is the "do the themes still work with
// what we've built" guarantee.
// Run from repo root: node scripts/verify-themes-compat.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createClient } = require("@supabase/supabase-js");

const env = {};
for (const line of readFileSync(
  new URL("../apps/web/.env.local", import.meta.url),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// Import the real schema (Node strips the TS types; it only imports `zod`).
const schema = await import(
  new URL("../apps/web/lib/website/sections.schema.ts", import.meta.url).href
);
const { parseSectionsLoose, sectionSchema, SECTION_TYPES } = schema;

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let fail = 0;
const usedTypes = new Set();

const { data: themes, error } = await supabase
  .from("site_themes")
  .select("slug, name, page_templates")
  .eq("is_active", true)
  .is("deleted_at", null)
  .order("sort_order");
if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

for (const theme of themes) {
  const pages = Array.isArray(theme.page_templates) ? theme.page_templates : [];
  let themeBad = 0;
  for (const page of pages) {
    const input = Array.isArray(page.sections) ? page.sections : [];
    for (const s of input) usedTypes.add(s.type);
    const parsed = parseSectionsLoose(input);
    if (parsed.length !== input.length) {
      themeBad += input.length - parsed.length;
      // Pinpoint which sections fail and why.
      for (const s of input) {
        const r = sectionSchema.safeParse(s);
        if (!r.success) {
          const issue = r.error.issues[0];
          console.log(
            `  ❌ ${theme.slug}/${page.kind} → section "${s.type}" (${s.id}) dropped: ${issue.path.join(".")} — ${issue.message}`,
          );
        }
      }
    }
  }
  const ok = themeBad === 0;
  console.log(
    `${ok ? "✅" : "❌"} ${theme.slug} (${theme.name}) — ${pages.length} pages, ${ok ? "all sections valid" : `${themeBad} section(s) dropped`}`,
  );
  if (!ok) fail++;
}

console.log(
  `\nSection types used across themes: ${[...usedTypes].sort().join(", ")}`,
);
const unknown = [...usedTypes].filter((t) => !SECTION_TYPES.includes(t));
if (unknown.length) {
  console.log(`❌ Unknown section types in themes: ${unknown.join(", ")}`);
  fail++;
} else {
  console.log("✅ Every section type used by a theme exists in SECTION_TYPES");
}

console.log(fail === 0 ? "\n🎉 All themes are compatible." : `\n${fail} problem(s)`);
process.exit(fail === 0 ? 0 : 1);
