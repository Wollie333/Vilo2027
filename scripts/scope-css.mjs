// One-off generator: scope a flat mockup stylesheet under a wrapper class so it
// can live inside the app without leaking. Verbatim rules; only selectors change.
// Usage: node scripts/scope-css.mjs <src.css> <.wrapper> <out.css>
import fs from "node:fs";

const [, , src, wrapRaw, out] = process.argv;
if (!src || !wrapRaw || !out) {
  console.error("usage: scope-css.mjs <src> <.wrapper> <out>");
  process.exit(1);
}
const WRAP = wrapRaw.startsWith(".") ? wrapRaw : "." + wrapRaw;

let css = fs.readFileSync(src, "utf8").replace(/^﻿/, "");
// Strip comments (no nested comments in CSS).
css = css.replace(/\/\*[\s\S]*?\*\//g, "");

// Split a CSS string into top-level { sel, body } rules (brace-aware).
function splitRules(input) {
  const rules = [];
  let i = 0,
    buf = "";
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === "{") {
      let depth = 1,
        j = i + 1,
        body = "";
      while (j < n && depth > 0) {
        const c = input[j];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        if (depth > 0) body += c;
        j++;
      }
      rules.push({ sel: buf.trim(), body });
      buf = "";
      i = j;
    } else {
      buf += ch;
      i++;
    }
  }
  return rules;
}

function prefixSelector(sel) {
  const mapped = sel
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (s === ":root" || s === "html" || s === "body") return WRAP;
      if (s === "*") return `${WRAP} *`;
      if (s.startsWith(WRAP)) return s;
      // pseudo-elements on the wrapper itself (rare) — leave under wrapper
      return `${WRAP} ${s}`;
    });
  return [...new Set(mapped)].join(", "); // dedupe (html,body → one wrapper rule)
}

// The wrapper is a content div, not the page — drop page-level size/margin
// resets from collapsed html/body rules so it never fights the app layout.
function isPageReset(sel) {
  return sel
    .split(",")
    .every((s) => ["html", "body"].includes(s.trim()));
}
function dropPageResets(body) {
  return body
    .split(";")
    .filter((d) => !/^\s*(height|min-height|margin)\s*:/.test(d))
    .join(";");
}

// Rules whose body should be left untouched (no inner selector prefixing).
const RAW_AT = ["@keyframes", "@font-face", "@import", "@charset"];

function transform(input) {
  return splitRules(input)
    .map(({ sel, body }) => {
      if (RAW_AT.some((a) => sel.startsWith(a))) {
        return `${sel} {${body}}`;
      }
      if (sel.startsWith("@media") || sel.startsWith("@supports")) {
        return `${sel} {\n${transform(body)}\n}`;
      }
      // `:root`/`body`/`html` collapse to the wrapper; merge their declarations.
      const mapped = prefixSelector(sel);
      const cleanBody = isPageReset(sel) ? dropPageResets(body) : body;
      if (!cleanBody.trim()) return ""; // drop rules emptied by reset-stripping
      return `${mapped} {${cleanBody}}`;
    })
    .filter(Boolean)
    .join("\n");
}

let outCss = transform(css).trim();

// Keyframes are global — namespace each name so the two files (and the rest of
// the app) can't clash on a shared name like `fadeUp`.
const slug = WRAP.replace(/^\./, "");
const kfNames = [
  ...new Set(
    [...outCss.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]),
  ),
];
for (const nm of kfNames) {
  outCss = outCss.replace(new RegExp(`\\b${nm}\\b`, "g"), `${slug}-${nm}`);
}

const header = `/* AUTO-GENERATED from a Vilo mockup stylesheet — scoped under ${WRAP}.\n   Source: ${src.split(/[\\/]/).pop()}. Do not edit by hand; regenerate via scripts/scope-css.mjs. */\n`;
fs.writeFileSync(out, header + outCss + "\n");
console.log(`wrote ${out} (${kfNames.length} keyframe(s) namespaced)`);
