#!/usr/bin/env node
// Generates docs/SCHEMA.md from the LIVE linked Supabase project.
//
// WHY THIS EXISTS: every hand-written schema doc in this repo has eventually
// lied. A rename orphaned a cron for 30 days; a lifecycle doc described a call
// site that never existed; the lifecycle index carried four phantom rows. Prose
// cannot be trusted because nothing forces it to stay true. This file is derived
// from the database itself, so the only way it goes stale is if you don't run it.
//
// It also re-runs the traps that have actually bitten this project (see RED
// FLAGS below), so those get caught on every regeneration instead of six weeks
// later by accident.
//
//   node scripts/generate-schema-doc.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "SCHEMA.md");

function introspect() {
  const raw = execFileSync(
    "supabase",
    ["db", "query", "--linked", "--file", join(ROOT, "scripts", "introspect-schema.sql")],
    // shell:true — on Windows `supabase` is a .cmd shim that cannot be spawned directly.
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, shell: true },
  );
  // The CLI prints chatter around the payload; take the first balanced object.
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("No JSON in CLI output");
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) { end = i + 1; break; }
  }
  return JSON.parse(raw.slice(start, end)).rows[0].doc;
}

const md = [];
const p = (s = "") => md.push(s);

const doc = introspect();
const tables = doc.tables ?? [];
const functions = doc.functions ?? [];
const crons = doc.crons ?? [];
const vaultNames = new Set(doc.vault_secret_names ?? []);
const tableNames = new Set(tables.map((t) => t.name));

// ---------------------------------------------------------------------------
// RED FLAGS — each one is a bug class that has actually cost this project time.
// ---------------------------------------------------------------------------
// Grouped by class: one systemic issue affecting 70 functions is ONE finding, not
// 70 — a flat list of near-identical lines buries the rare, severe ones.
const groups = new Map();
const flag = (klass, detail) => {
  if (!groups.has(klass)) groups.set(klass, []);
  groups.get(klass).push(detail);
};
const flags = [];

// 1. A RENAME ORPHANS pg_cron. cron.job.command is TEXT, so ALTER TABLE ...
//    RENAME cannot reach it. This froze rankings for 30 days, silently.
const KNOWN_OLD = ["listings", "listing_policies", "host_business_details"];
for (const c of crons) {
  for (const old of KNOWN_OLD) {
    if (new RegExp(`\\b${old}\\b`).test(c.command) && !tableNames.has(old)) {
      flag("Cron references a table that no longer exists (a rename orphaned it — `cron.job.command` is TEXT, so `ALTER TABLE … RENAME` cannot reach it). The job fails every tick, silently.",
        `\`${c.name}\` → \`${old}\``);
    }
  }
}

// 2. A Vault-gated cron whose secret is unset reports `succeeded` while doing
//    nothing (unset secret -> NOTICE + return). Six crons were dead this way.
for (const c of crons) {
  if (!c.vault_gated) continue;
  const needed = [...c.command.matchAll(/name\s*=\s*'([^']+)'/g)].map((m) => m[1]);
  const missing = needed.filter((n) => !vaultNames.has(n));
  if (missing.length) {
    flag("Vault-gated cron whose secret is NOT set. An unset secret makes the job return early — so it reports `succeeded` while doing nothing at all. Needs a founder to `vault.create_secret` per environment.",
      `\`${c.name}\` needs \`${missing.join("`, `")}\``);
  }
}

// 3. SECURITY DEFINER + executable by `anon` = an RLS bypass on a public URL.
//    PROVEN 2026-07-16: as `anon`, `apply_wielo_credit` minted 500 credits, and
//    the publishable key reaches POST /rest/v1/rpc/. Postgres grants EXECUTE to
//    PUBLIC on CREATE, and anon inherits it — so `REVOKE ... FROM anon` is a
//    NO-OP. You must revoke from PUBLIC. See 20260716310000.
for (const f of functions) {
  if (f.secdef && f.anon_exec && !f.trigger) {
    flag("**SECURITY DEFINER function executable by `anon`** — runs as owner, bypasses RLS, reachable at `POST /rest/v1/rpc/<name>` with the publishable key. Some legitimately serve public pages; each needs a judgement. Remember `REVOKE ... FROM anon` is a NO-OP — revoke from **PUBLIC**.",
      `\`${f.name}\``);
  }
}

// 4. SECURITY DEFINER without a pinned search_path is a privilege-escalation
//    surface (this repo has already shipped a fix-search_path migration).
for (const f of functions) {
  if (!f.secdef) continue;
  const cfg = (f.config ?? []).join(",");
  if (!/search_path=/.test(cfg)) {
    flag("SECURITY DEFINER function with **no pinned `search_path`** — runs as owner, resolves object names via the caller's path. Fix: `SET search_path = public, pg_temp`.",
      `\`${f.name}\``);
  }
}

// 4. THE view_count TRAP: a SECURITY INVOKER trigger writing to a DIFFERENT
//    RLS table matches zero rows for anyone the target's policy excludes —
//    and says nothing. Verify each hit; a SECURITY DEFINER caller makes it safe.
const rlsTables = tables.filter((t) => t.rls).map((t) => t.name);
for (const t of tables) {
  for (const tg of t.triggers ?? []) {
    const fn = functions.find((f) => f.name === tg.fn);
    if (!fn || fn.secdef || !fn.src) continue;
    for (const target of rlsTables) {
      if (target === t.name) continue;
      if (new RegExp(`(update|insert\\s+into|delete\\s+from)\\s+(public\\.)?${target}\\b`, "i").test(fn.src)) {
        flag("SECURITY INVOKER trigger writing to a DIFFERENT RLS table — if the target's policy excludes the user who fired the trigger, the write matches **zero rows and says nothing** (this is the `view_count` bug). VERIFY each hit: it is safe if every writer reaches it through a SECURITY DEFINER function.",
          `\`${tg.name}\` on \`${t.name}\` → writes \`${target}\``);
      }
    }
  }
}

// ---------------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const secdefCount = functions.filter((f) => f.secdef).length;

p("# Wielo — Live Database Schema (GENERATED)");
p();
p("> ⚠️ **GENERATED FILE — DO NOT EDIT BY HAND.** Your edits will be overwritten.");
p("> ");
p("> **Regenerate:** `node scripts/generate-schema-doc.mjs`");
p("> **Source of truth:** the **live linked Supabase project** — not the migrations, not prose.");
p(`> **Last generated:** ${today}`);
p();
p("Every hand-written schema doc in this repo has eventually lied: a rename orphaned a cron");
p("for 30 days, a lifecycle doc described a call site that never existed, the lifecycle index");
p("carried four phantom rows. Prose goes stale because nothing forces it to stay true. This");
p("file is derived from the database, so read it instead of trusting a note — and regenerate");
p("it after any migration.");
p();
p("## Summary");
p();
p(`| | |`);
p(`|---|---|`);
p(`| Tables | **${tables.length}** (${tables.filter((t) => t.rls).length} with RLS) |`);
p(`| Functions | **${functions.length}** (${secdefCount} SECURITY DEFINER, ${functions.filter((f) => f.trigger).length} trigger fns) |`);
p(`| Cron jobs | **${crons.length}** (${crons.filter((c) => c.vault_gated).length} Vault-gated, ${crons.filter((c) => !c.active).length} inactive) |`);
p(`| Vault secrets set | **${vaultNames.size}** |`);
p();

p("## 🚩 Automated red flags");
p();
p("These checks re-run on every regeneration. Each is a bug class that has already cost this");
p("project real time — see the comments in `scripts/generate-schema-doc.mjs` for the history.");
p();
if (groups.size === 0) {
  p("_None. (This is a real result, not an absence of checking.)_");
} else {
  for (const [klass, items] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    p(`### ${items.length} × ${klass}`);
    p();
    for (const i of items) p(`- ${i}`);
    p();
  }
}
p();

p("## Cron jobs");
p();
p("| job | schedule | active | Vault-gated |");
p("|---|---|---|---|");
for (const c of crons) {
  p(`| \`${c.name}\` | \`${c.schedule}\` | ${c.active ? "yes" : "**NO**"} | ${c.vault_gated ? "yes" : "—"} |`);
}
p();

p("## Functions");
p();
p("`SD` = SECURITY DEFINER. A denormalised counter written by a trigger across an ownership");
p("boundary **must** be SD, or RLS silently drops the write (see `sync_looking_for_view_count`).");
p();
p("| function | SD | search_path pinned | kind |");
p("|---|---|---|---|");
for (const f of functions) {
  const pinned = (f.config ?? []).some((c) => c.startsWith("search_path="));
  p(`| \`${f.name}\` | ${f.secdef ? "**yes**" : "—"} | ${f.secdef ? (pinned ? "yes" : "**NO**") : "—"} | ${f.trigger ? "trigger" : "callable"} |`);
}
p();

p("## Tables");
p();
for (const t of tables) {
  p(`### \`${t.name}\`${t.rls ? "" : "  — ⚠️ **NO RLS**"}`);
  p();
  p("| column | type | null | default |");
  p("|---|---|---|---|");
  for (const c of t.columns ?? []) {
    const def = c.default ? `\`${String(c.default).replace(/\|/g, "\\|").slice(0, 60)}\`` : "—";
    p(`| \`${c.name}\` | ${c.type} | ${c.notnull ? "—" : "yes"} | ${def} |`);
  }
  p();
  const list = (label, arr) => {
    if (!arr?.length) return;
    p(`**${label}:**`);
    for (const x of arr) p(`- \`${String(x).replace(/\|/g, "\\|")}\``);
    p();
  };
  list("Foreign keys", t.fks);
  list("Unique", t.uniques);
  list("Checks", t.checks);
  if (t.triggers?.length) {
    p("**Triggers:**");
    for (const tg of t.triggers) p(`- \`${tg.name}\` → \`${tg.fn}()\`${tg.secdef ? " *(SECURITY DEFINER)*" : ""}`);
    p();
  }
  if (t.policies?.length) {
    const CMD = { r: "SELECT", a: "INSERT", w: "UPDATE", d: "DELETE", "*": "ALL" };
    p("**RLS policies:**");
    for (const pol of t.policies) {
      const parts = [];
      if (pol.using) parts.push(`USING ${pol.using}`);
      if (pol.check) parts.push(`CHECK ${pol.check}`);
      p(`- \`${pol.name}\` (${CMD[pol.cmd] ?? pol.cmd}) — \`${parts.join(" ").replace(/\|/g, "\\|")}\``);
    }
    p();
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, md.join("\n"), "utf8");

console.log(`Wrote ${OUT}`);
console.log(`  ${tables.length} tables, ${functions.length} functions, ${crons.length} crons`);
const total = [...groups.values()].reduce((n, v) => n + v.length, 0);
console.log(`  ${total} red flag(s) in ${groups.size} class(es)`);
for (const [klass, items] of groups) {
  console.log(`   - ${items.length} × ${klass.split(".")[0].replace(/\*\*/g, "")}`);
}
