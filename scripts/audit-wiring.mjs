#!/usr/bin/env node
// Answers the only question that catches this codebase's dominant bug:
// WHAT CALLS THIS?
//
// `view_count` was broken for the life of the platform because
// `recordPostViewAction` existed, type-checked, linted — and was never invoked
// by anything. Build/lint/tests cannot see that, and neither can a human reading
// a doc that claims a call site exists (ours did; it never had one).
//
// Two sweeps:
//   1. Exported runtime symbols in apps/ + packages/ with zero references.
//   2. Project-owned DB functions with no caller in app code, cron, or migrations.
//
//   node scripts/audit-wiring.mjs          # both sweeps
//   node scripts/audit-wiring.mjs --code   # skip the DB sweep (no network)
//
// ⚠️ READ docs/WIRING_AUDIT.md → "False positives this sweep must survive" BEFORE
// believing any hit. In particular: a symbol used only inside its OWN file (the
// `withAdminAudit` wrapper pattern) is NOT dead, and a file whose only caller is
// itself dead looks alive — so RE-RUN AFTER EACH DELETION until it stops changing.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const codeOnly = process.argv.includes("--code");

// Next.js calls these itself; exported-but-never-imported is correct for them.
const NEXT_FILES = new Set([
  "page.tsx", "page.ts", "layout.tsx", "layout.ts", "route.ts", "route.tsx",
  "middleware.ts", "not-found.tsx", "loading.tsx", "error.tsx", "global-error.tsx",
  "template.tsx", "default.tsx", "sitemap.ts", "robots.ts", "manifest.ts",
  "opengraph-image.tsx", "twitter-image.tsx", "icon.tsx", "apple-icon.tsx",
  "instrumentation.ts",
]);
const NEXT_EXPORTS = new Set([
  "default", "metadata", "generateMetadata", "generateStaticParams", "revalidate",
  "dynamic", "dynamicParams", "fetchCache", "runtime", "preferredRegion",
  "maxDuration", "viewport", "generateViewport", "config", "alt", "size",
  "contentType", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "worktrees", ".claude", "dist", "build"]);

function walk(dir, test, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, test, out); }
    else if (test(e.name)) out.push(p);
  }
  return out;
}

const rel = (f) => relative(ROOT, f).replace(/\\/g, "/");

// ---------------------------------------------------------------------------
// Sweep 1 — dead exports
// ---------------------------------------------------------------------------
const tsTest = (n) => /\.(ts|tsx)$/.test(n) && !/\.d\.ts$/.test(n);
const files = [
  ...walk(join(ROOT, "apps/web"), tsTest),
  ...walk(join(ROOT, "apps/mobile"), tsTest),
  ...walk(join(ROOT, "packages"), tsTest),
].filter((f) => !f.endsWith("database.types.ts"));

const texts = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
// Runtime symbols only — a dead exported `type` is noise, not a missing feature.
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm;

const deadExports = [];
for (const [file, text] of texts) {
  const base = basename(file);
  if (NEXT_FILES.has(base) || /\.(test|spec)\.tsx?$/.test(base)) continue;

  const names = new Set();
  let m;
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(text))) names.add(m[1]);

  for (const name of names) {
    if (NEXT_EXPORTS.has(name)) continue;
    const word = new RegExp(`\\b${name}\\b`, "g");
    let total = 0;
    for (const [, t] of texts) total += (t.match(word) || []).length;
    // Same-file uses COUNT (the withAdminAudit wrapper pattern) — subtract only
    // the declaration itself.
    const decls = (text.match(
      new RegExp(`^export\\s+(?:async\\s+)?(?:function|const|class)\\s+${name}\\b`, "gm"),
    ) || []).length;
    if (total - decls === 0) deadExports.push({ file: rel(file), name });
  }
}

const byFile = new Map();
for (const d of deadExports) {
  if (!byFile.has(d.file)) byFile.set(d.file, []);
  byFile.get(d.file).push(d.name);
}

console.log(`\n=== Sweep 1: exported runtime symbols with ZERO references (${deadExports.length})`);
console.log(`    across ${files.length} files\n`);
for (const [f, names] of [...byFile].sort()) console.log(`  ${f}\n      ${names.join(", ")}`);

// ---------------------------------------------------------------------------
// Sweep 2 — DB functions nothing calls
// ---------------------------------------------------------------------------
if (!codeOnly) {
  let raw;
  try {
    // Pass the SQL as a FILE: shell:true is required on Windows (`supabase` is a
    // .cmd shim) and inline SQL does not survive shell quoting.
    raw = execFileSync(
      "supabase",
      ["db", "query", "--linked", "--file", join(ROOT, "scripts", "introspect-callables.sql")],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: true },
    );
  } catch (e) {
    console.log("\n=== Sweep 2 skipped (supabase CLI unavailable):", e.message.split("\n")[0]);
    process.exit(0);
  }

  const start = raw.indexOf("{");
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) { end = i + 1; break; }
  }
  const { fns, crons } = JSON.parse(raw.slice(start, end)).rows[0].doc;

  const appText = [
    ...files,
    ...walk(join(ROOT, "supabase/functions"), (n) => /\.ts$/.test(n)),
  ].map((f) => texts.get(f) ?? readFileSync(f, "utf8")).join("\n");
  const cronText = (crons ?? []).join("\n");
  const migs = walk(join(ROOT, "supabase/migrations"), (n) => n.endsWith(".sql")).map((f) => readFileSync(f, "utf8"));

  const deadFns = [];
  for (const fn of fns ?? []) {
    const word = new RegExp(`\\b${fn}\\b`, "g");
    if ((appText.match(word) || []).length) continue;
    if ((cronText.match(word) || []).length) continue;
    // Migration references that are NOT this function's own definition/drop.
    let calls = 0;
    for (const t of migs) {
      const all = (t.match(word) || []).length;
      const defs = (t.match(new RegExp(`(CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION|DROP\\s+FUNCTION(\\s+IF\\s+EXISTS)?)\\s+(public\\.)?${fn}\\b`, "gi")) || []).length;
      const comments = (t.match(new RegExp(`--[^\\n]*\\b${fn}\\b`, "g")) || []).length;
      calls += Math.max(0, all - defs - comments);
    }
    if (calls === 0) deadFns.push(fn);
  }

  console.log(`\n=== Sweep 2: DB functions with NO caller in app, cron, or migrations (${deadFns.length})`);
  console.log(`    of ${(fns ?? []).length} project-owned functions\n`);
  for (const f of deadFns) console.log(`  ${f}`);
  console.log();
}
