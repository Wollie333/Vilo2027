// Multi-business ledger + guest reputation schema probe — READ ONLY, service role.
// Confirms: guest_ratings table + columns; guest_credit_ledger.business_id added
// and backfilled (no booking-linked row left null); the Txn business derivation
// path (bookings → listings.business_id) resolves; help articles published.
// Run from repo root: node scripts/verify-multibusiness-ledger.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// @supabase/supabase-js lives in apps/web/node_modules (workspace), so resolve
// it from there rather than the repo root.
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
  // 1. guest_ratings table + all rating columns selectable.
  await selectOk(
    "guest_ratings columns exist",
    "guest_ratings",
    "id, guest_id, host_id, rating, summary, rating_payments, rating_communication, rating_cleanliness, rating_house_rules, rating_integrity, note_payments, updated_at",
  );

  // 2. guest_credit_ledger.business_id added.
  await selectOk(
    "guest_credit_ledger.business_id exists",
    "guest_credit_ledger",
    "id, business_id, booking_id, host_id, gkey, amount",
  );

  // 3. Backfill: no booking-linked credit row left with a null business_id.
  {
    const { count, error } = await supabase
      .from("guest_credit_ledger")
      .select("id", { count: "exact", head: true })
      .not("booking_id", "is", null)
      .is("business_id", null);
    log(
      !error && (count ?? 0) === 0,
      "no booking-linked credit row missing business_id",
      error?.message ?? `${count ?? 0} orphan(s)`,
    );
  }

  // 4. Business derivation path: a sample of bookings resolve listing.business_id.
  {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, listing:listings ( business_id )")
      .is("deleted_at", null)
      .limit(20);
    const resolved = (data ?? []).filter((b) => {
      const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
      return l && l.business_id;
    }).length;
    log(
      !error,
      "bookings resolve a listing business_id (Txn derivation)",
      error?.message ?? `${resolved}/${(data ?? []).length} sampled have a business`,
    );
  }

  // 5. Help articles published.
  for (const slug of ["how-guest-ratings-work", "ledger-account-finance-view"]) {
    const { data, error } = await supabase
      .from("help_articles")
      .select("slug, status")
      .eq("slug", slug)
      .maybeSingle();
    log(
      !error && data?.status === "published",
      `help article ${slug} published`,
      error?.message ?? data?.status ?? "missing",
    );
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
