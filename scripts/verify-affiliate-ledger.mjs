// Affiliate program ledger + schema verifier — READ ONLY, service role.
// Phase 1: schema probe every new table + settings/fee seed present.
// Later phases extend this with: no orphan/double-accrual commissions, refund
// coverage, recompute parity (rate × NET == stored), balance invariants.
// Run from repo root: node scripts/verify-affiliate-ledger.mjs
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

async function selectOk(label, table, columns) {
  const { error } = await supabase.from(table).select(columns).limit(1);
  log(!error, label, error?.message ?? "");
}

async function main() {
  // 1. Schema probe — every new table's key columns are selectable.
  await selectOk(
    "affiliate_accounts columns",
    "affiliate_accounts",
    "id, user_id, slug, status, terms_version, accepted_at, payout_threshold, default_payout_method, suspended_at",
  );
  await selectOk(
    "affiliate_clicks columns",
    "affiliate_clicks",
    "id, affiliate_id, slug, visitor_hash, landing_path, created_at",
  );
  await selectOk(
    "affiliate_referrals columns",
    "affiliate_referrals",
    "id, affiliate_id, referred_user_id, referred_host_id, source, click_id, bound_at",
  );
  await selectOk(
    "affiliate_commissions columns",
    "affiliate_commissions",
    "id, affiliate_id, referral_id, product_id, source_ledger_id, entry_type, kind, base_amount, rate_type, rate_value, commission_amount, status, billing_period, hold_until, refund_ledger_id, payout_id",
  );
  await selectOk(
    "affiliate_payouts columns",
    "affiliate_payouts",
    "id, affiliate_id, method, status, gross_amount, fee_amount, net_amount, fee_config_snapshot, destination_snapshot, provider_reference",
  );
  await selectOk(
    "affiliate_payout_methods columns",
    "affiliate_payout_methods",
    "id, affiliate_id, method, is_default, bank_name, account_number, paystack_recipient_code, paypal_email",
  );
  await selectOk(
    "affiliate_settings columns",
    "affiliate_settings",
    "id, cookie_days, hold_days, min_payout_threshold, terms_version, self_referral_blocked, attribution_model",
  );
  await selectOk(
    "affiliate_payout_fees columns",
    "affiliate_payout_fees",
    "method, fixed_fee, percent_fee, cap_fee, currency",
  );

  // 2. Singleton settings row seeded.
  {
    const { data, error } = await supabase
      .from("affiliate_settings")
      .select("cookie_days, hold_days, min_payout_threshold")
      .eq("id", true)
      .maybeSingle();
    log(
      !error && !!data,
      "affiliate_settings singleton seeded",
      error?.message ?? (data ? `cookie ${data.cookie_days}d / hold ${data.hold_days}d` : "missing"),
    );
  }

  // 3. All three payout-fee rows seeded.
  {
    const { data, error } = await supabase
      .from("affiliate_payout_fees")
      .select("method");
    const methods = new Set((data ?? []).map((r) => r.method));
    const ok = !error && ["eft", "paystack", "paypal"].every((m) => methods.has(m));
    log(ok, "affiliate_payout_fees seeded for eft/paystack/paypal", error?.message ?? `${methods.size}/3`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
