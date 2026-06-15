// Live validation of the admin pages' Supabase queries (service role, limit 1).
// Catches phantom columns / bad embeds / ambiguous FKs that only surface at
// runtime. Read-only — selects with limit(1), no writes. Run with: node.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(
  new URL("../apps/web/.env.local", import.meta.url),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// [label, table, selectString, extra(q)=>q]
const checks = [
  [
    "users/list",
    "user_profiles",
    "id, full_name, email, role, phone, is_active, created_at, deleted_at",
  ],
  [
    "listings/list",
    "listings",
    "id, name, slug, listing_type, is_published, is_featured, city, province, base_price, currency, created_at, host:hosts ( id, handle, display_name )",
  ],
  [
    "bookings/list",
    "bookings",
    "id, reference, status, payment_status, payment_method, check_in, check_out, total_amount, currency, created_at, listing:listings ( name ), host:hosts ( display_name, handle ), guest:user_profiles!bookings_guest_id_fkey ( full_name, email )",
  ],
  [
    "reporting/subscriptions",
    "subscriptions",
    "plan, billing_cycle, status",
  ],
  [
    "reporting/profiles",
    "user_profiles",
    "role, created_at",
  ],
  [
    "reporting/bookings",
    "bookings",
    "total_amount, status",
  ],
  [
    "products/list",
    "products",
    "id, name, type, price, currency, billing_cycle, is_active, is_visible, is_recommended, sort_order, trial_days, slug, setup_fee, payment_methods, bullets",
  ],
  [
    "product_features",
    "product_features",
    "product_id, feature_key, is_enabled, limit_value",
  ],
  [
    "platform_ledger",
    "platform_ledger",
    "id, created_at, type, status, amount, currency, vat_amount, plan, billing_cycle, provider, provider_reference, reason, user_id, host_id, product_id, payer:user_profiles!user_id ( full_name, email ), host:hosts!host_id ( handle )",
  ],
  [
    "product_orders",
    "product_orders",
    "id, product_id, product_name, payer_email, payer_user_id, amount, currency, status, pay_token, provider_reference, method, paid_at",
  ],
  [
    "platform_payment_settings",
    "platform_payment_settings",
    "paystack_enabled, eft_enabled, eft_bank_name, eft_account_name, eft_account_number, eft_branch_code, eft_reference_hint",
  ],
];

let fails = 0;
for (const [label, table, sel] of checks) {
  const { error } = await db.from(table).select(sel).limit(1);
  if (error) {
    fails += 1;
    console.log(`❌ ${label} (${table}): ${error.message}`);
  } else {
    console.log(`✅ ${label}`);
  }
}

// The current bookings .or() — expected to FAIL (proves the bug).
{
  const { error } = await db
    .from("bookings")
    .select("id")
    .or("reference.ilike.%x%,guest_name.ilike.%x%,guest_email.ilike.%x%")
    .limit(1);
  console.log(
    error
      ? `⚠️  bookings .or(guest_name/guest_email) FAILS as expected: ${error.message}`
      : `❓ bookings .or(guest_name/guest_email) unexpectedly OK`,
  );
}

console.log(`\n${fails === 0 ? "All base queries valid." : `${fails} failing.`}`);
process.exit(fails === 0 ? 0 : 1);
