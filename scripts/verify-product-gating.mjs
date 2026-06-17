// Product-driven feature gating verifier — READ ONLY, service role.
// Confirms check_feature_permission resolves from product_features via
// subscriptions.product_id (the product the host actually bought), and falls
// back to plan_features when no product is linked.
// Run from repo root: node scripts/verify-product-gating.mjs
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
let warn = 0;
const log = (ok, label, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};
const note = (label, extra = "") => {
  console.log(`⚠️  ${label}${extra ? ` — ${extra}` : ""}`);
  warn++;
};

async function main() {
  // 1. RPC exists and returns the expected shape.
  const { data: anyHost } = await supabase
    .from("hosts")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!anyHost) {
    note("no hosts in DB — cannot exercise the RPC (seed demo data first)");
  } else {
    const { data: shape, error: shapeErr } = await supabase.rpc(
      "check_feature_permission",
      { p_host_id: anyHost.id, p_feature_key: "listings_limit" },
    );
    log(
      !shapeErr &&
        shape &&
        "is_enabled" in shape &&
        "source" in shape,
      "check_feature_permission returns {is_enabled, limit_value, source}",
      shapeErr?.message ?? JSON.stringify(shape),
    );
  }

  // 2. Product-driven resolution: an active sub WITH product_id should resolve a
  //    feature defined on that product to source='product'.
  const { data: prodSub } = await supabase
    .from("subscriptions")
    .select("host_id, product_id, plan, status")
    .not("product_id", "is", null)
    .in("status", ["trialing", "active"])
    .limit(1)
    .maybeSingle();

  if (!prodSub) {
    note(
      "no active subscription has product_id set yet",
      "buy a product (or admin → set product) to exercise product gating end-to-end",
    );
  } else {
    const { data: feat } = await supabase
      .from("product_features")
      .select("feature_key, is_enabled, limit_value")
      .eq("product_id", prodSub.product_id)
      .limit(1)
      .maybeSingle();
    if (!feat) {
      note(
        `product ${prodSub.product_id} has no product_features rows`,
        "add features in admin → products to gate by product",
      );
    } else {
      const { data: res, error } = await supabase.rpc(
        "check_feature_permission",
        { p_host_id: prodSub.host_id, p_feature_key: feat.feature_key },
      );
      log(
        !error && res?.source === "product",
        `feature '${feat.feature_key}' resolves from the PRODUCT (source='product')`,
        error?.message ?? `source=${res?.source}`,
      );
      log(
        !error && res?.is_enabled === feat.is_enabled,
        `product feature '${feat.feature_key}' is_enabled matches product_features`,
        `rpc=${res?.is_enabled} table=${feat.is_enabled}`,
      );
    }
  }

  // 3. Fallback: an active sub WITHOUT product_id still resolves via plan.
  const { data: planSub } = await supabase
    .from("subscriptions")
    .select("host_id, plan, status")
    .is("product_id", null)
    .in("status", ["trialing", "active"])
    .limit(1)
    .maybeSingle();
  if (!planSub) {
    note("no active subscription without product_id — fallback path not exercised");
  } else {
    const { data: pf } = await supabase
      .from("plan_features")
      .select("feature_key")
      .eq("plan", planSub.plan)
      .limit(1)
      .maybeSingle();
    if (pf) {
      const { data: res, error } = await supabase.rpc(
        "check_feature_permission",
        { p_host_id: planSub.host_id, p_feature_key: pf.feature_key },
      );
      log(
        !error && (res?.source === "plan" || res?.source === "override"),
        `plan-only sub falls back to plan_features (source='${res?.source}')`,
        error?.message ?? "",
      );
    }
  }

  console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
