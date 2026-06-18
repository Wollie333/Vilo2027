// READ-ONLY probe of the live policy functions to resolve migration drift.
// Determines: (1) get_listing_policy_summary signature(s) that exist, (2) whether
// it returns booking_terms today, (3) whether host-default policies resolve.
// Run from repo root: node scripts/probe-policy-fns.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
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

const { data: prop } = await supabase
  .from("properties")
  .select("id, host_id, name")
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();
console.log("sample property:", prop?.id, prop?.name);

if (prop) {
  const oneArg = await supabase.rpc("get_listing_policy_summary", {
    p_listing_id: prop.id,
  });
  console.log("\n[1-arg call] error:", oneArg.error?.message ?? "none");
  if (oneArg.data) console.log("  keys:", Object.keys(oneArg.data));

  const twoArg = await supabase.rpc("get_listing_policy_summary", {
    p_listing_id: prop.id,
    p_room_id: null,
  });
  console.log("[2-arg call] error:", twoArg.error?.message ?? "none");
  if (twoArg.data) console.log("  keys:", Object.keys(twoArg.data));
}

// Existing booking_terms policies (should be archived from legal_platform_wide).
const { count: btCount } = await supabase
  .from("policies")
  .select("id", { count: "exact", head: true })
  .eq("type", "booking_terms");
console.log("\nbooking_terms policies (any status):", btCount);

// Sample snapshot types on a recent booking to see what gets frozen.
const { data: snaps } = await supabase
  .from("policy_snapshots")
  .select("booking_id, policy_type")
  .limit(20);
const types = [...new Set((snaps ?? []).map((s) => s.policy_type))];
console.log("snapshot types seen:", types);

// property_policies.policy_type values in use (confirms which types are assignable).
const { data: pp } = await supabase
  .from("property_policies")
  .select("policy_type")
  .limit(50);
console.log("property_policies types in use:", [
  ...new Set((pp ?? []).map((r) => r.policy_type)),
]);
