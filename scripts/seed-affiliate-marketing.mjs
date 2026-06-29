// Seed a few starter affiliate marketing assets for testing — service role.
// Idempotent: skips any asset whose (category, title) already exists.
// Pre-launch demo data only (the DB gets wiped before launch).
// Run from repo root: node scripts/seed-affiliate-marketing.mjs
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

const banner = (w, h, text) =>
  `https://placehold.co/${w}x${h}/064E3B/FFFFFF/png?text=${encodeURIComponent(text)}`;

const ASSETS = [
  {
    category: "banner",
    title: "Leaderboard — Zero booking fees",
    description: "728 × 90 · PNG",
    file_url: banner(728, 90, "Wielo — Zero booking fees"),
    mime_type: "image/png",
    width: 728,
    height: 90,
    sort_order: 0,
  },
  {
    category: "banner",
    title: "Square — Keep 100%",
    description: "1080 × 1080 · PNG",
    file_url: banner(1080, 1080, "Keep 100% of every booking"),
    mime_type: "image/png",
    width: 1080,
    height: 1080,
    sort_order: 1,
  },
  {
    category: "email",
    title: "A better way to run your guesthouse",
    body: `Hi there,

If you're still paying commission on every booking, take a look at Wielo. It's a complete platform for hosts — calendar, guest inbox, direct payments — with zero booking fees, ever.

Start a free trial here:
{link}

Happy hosting`,
    sort_order: 0,
  },
  {
    category: "email",
    title: "Keep 100% of what your guests pay",
    body: `Hello,

Quick one — I've been recommending Wielo to fellow hosts. Your payout always equals exactly what the guest pays. No service fee, no commission.

See how it works:
{link}`,
    sort_order: 1,
  },
  {
    category: "social",
    title: "Instagram caption",
    body: `Stop giving away your earnings to booking sites 💸 Wielo lets you take direct bookings with ZERO commission. Your payout = exactly what your guest pays. 👉 {link} #directbooking #guesthouse`,
    sort_order: 0,
  },
  {
    category: "social",
    title: "WhatsApp message",
    body: `Hey! If you run a place, you'll want this — Wielo charges hosts zero booking fees. Free trial: {link}`,
    sort_order: 1,
  },
  {
    category: "prompt",
    title: "Facebook post generator",
    body: `Write a warm, 80-word Facebook post for South African guesthouse owners recommending Wielo — a direct-booking platform with zero booking fees. End with the link {link}`,
    sort_order: 0,
  },
  {
    category: "video",
    title: "Wielo in 90 seconds",
    description: "Short explainer — share with your link.",
    link_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    body: `Watch how Wielo works, then start a free trial: {link}`,
    sort_order: 0,
  },
  {
    category: "blog",
    title: "Why direct bookings beat the OTAs",
    description: "Guide to share with hosts.",
    link_url: "https://wielo.co.za/blog/direct-bookings",
    body: `A short read on keeping 100% of your booking revenue. Share it with your link: {link}`,
    sort_order: 0,
  },
];

let added = 0;
let skipped = 0;
for (const a of ASSETS) {
  const { data: existing } = await supabase
    .from("marketing_assets")
    .select("id")
    .eq("category", a.category)
    .eq("title", a.title)
    .maybeSingle();
  if (existing) {
    skipped++;
    console.log(`• skip (exists): [${a.category}] ${a.title}`);
    continue;
  }
  const { error } = await supabase
    .from("marketing_assets")
    .insert({ is_active: true, ...a });
  if (error) {
    console.log(`❌ [${a.category}] ${a.title} — ${error.message}`);
  } else {
    added++;
    console.log(`✅ [${a.category}] ${a.title}`);
  }
}
console.log(`\n${added} added, ${skipped} skipped.`);
process.exit(0);
