// Aria default-theme verifier — READ ONLY, service role.
// Confirms the Aria flagship theme is live on the linked DB: present, active,
// the SOLE default, carries a valid 7-page blueprint (incl. the home `trust`
// section), and every section has the props the sectionSchema requires (so
// parseSectionsLoose won't silently drop any at render).
// Run from repo root: node scripts/verify-theme-aria.mjs
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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let pass = 0;
let fail = 0;
const log = (ok, label, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

// Minimal required-prop check mirroring sections.schema.ts (the props that are
// NOT optional and have no default — everything else the Zod schema fills).
const REQUIRED = {
  hero: (p) => typeof p.headline === "string" && p.headline.length > 0,
  intro: (p) => typeof p.body === "string" && p.body.length > 0,
  host_bio: (p) => typeof p.body === "string" && p.body.length > 0,
  cta: (p) =>
    typeof p.heading === "string" &&
    typeof p.button_label === "string" &&
    typeof p.button_href === "string",
  amenities: (p) =>
    Array.isArray(p.items) && p.items.every((i) => typeof i.label === "string"),
  highlights: (p) =>
    Array.isArray(p.items) && p.items.every((i) => typeof i.title === "string"),
  trust: (p) =>
    Array.isArray(p.items) && p.items.every((i) => typeof i.label === "string"),
};

async function main() {
  const { data: themes, error } = await supabase
    .from("site_themes")
    .select("slug, name, is_active, is_default, base, page_templates")
    .is("deleted_at", null);
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const aria = themes.find((t) => t.slug === "aria");
  log(!!aria, "Aria theme exists in the catalogue");
  if (!aria) {
    summary();
    return;
  }

  log(aria.is_active === true, "Aria is active");
  log(aria.is_default === true, "Aria is the default theme");

  const defaults = themes.filter((t) => t.is_default);
  log(
    defaults.length === 1 && defaults[0].slug === "aria",
    "Aria is the SOLE default",
    `defaults: ${defaults.map((t) => t.slug).join(", ") || "none"}`,
  );

  const b = aria.base ?? {};
  log(b.font === "elegant", "base.font = elegant", String(b.font));
  log(b.radius === "lg", "base.radius = lg", String(b.radius));
  log(
    b.palette?.accent === "#2F5D4F",
    "base accent = #2F5D4F (eucalyptus)",
    String(b.palette?.accent),
  );

  const pages = Array.isArray(aria.page_templates) ? aria.page_templates : [];
  log(pages.length === 7, "7 page templates", `got ${pages.length}`);
  const kinds = pages.map((p) => p.kind);
  for (const k of [
    "home",
    "about",
    "rooms",
    "contact",
    "blog",
    "checkout",
    "thank-you",
  ]) {
    log(kinds.includes(k), `page "${k}" present`);
  }

  const home = pages.find((p) => p.kind === "home");
  const homeTypes = (home?.sections ?? []).map((s) => s.type);
  log(homeTypes.includes("trust"), "home page includes the Trust section");
  for (const t of ["hero", "gallery", "rooms_preview", "reviews", "location"]) {
    log(homeTypes.includes(t), `home includes auto/section "${t}"`);
  }

  // Every section: valid UUID id + required props present.
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  let bad = 0;
  const seen = new Set();
  for (const p of pages) {
    for (const s of p.sections ?? []) {
      if (!uuid.test(s.id || "")) bad++;
      if (seen.has(s.id)) bad++;
      seen.add(s.id);
      const check = REQUIRED[s.type];
      if (check && !check(s.props ?? {})) bad++;
    }
  }
  log(bad === 0, "every section has a unique UUID id + required props", `${seen.size} sections`);

  summary();
}

function summary() {
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("🎉 Aria is live and ready.");
  process.exit(fail === 0 ? 0 : 1);
}

main();
