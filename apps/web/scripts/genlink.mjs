// Mint a passwordless magic link for local admin verification.
//   node --env-file=.env.local scripts/genlink.mjs [email] [next]
// Prints a /auth/confirm URL you can paste into the browser.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Run from apps/web with: node --env-file=.env.local scripts/genlink.mjs");
  process.exit(1);
}

const email = process.argv[2] || "wollie@manamarketing.co.za";
const next = process.argv[3] || "/en/admin/communications";
const base = process.env.LINK_BASE || "http://localhost:3000";

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (error) {
  console.error("generateLink failed:", error.message);
  process.exit(1);
}
const hashed = data?.properties?.hashed_token;
if (!hashed) {
  console.error("No hashed_token returned");
  process.exit(1);
}
const link = `${base}/auth/confirm?token_hash=${hashed}&type=magiclink&next=${encodeURIComponent(next)}`;
console.log(link);
