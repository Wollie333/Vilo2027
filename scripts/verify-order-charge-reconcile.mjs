// Multi-payment-method charge reconcile verifier — READ ONLY, service role.
//
// Proves the bug + the fix for the "outstanding R499 + received R499 on one
// order" issue (a buyer picked EFT — seeding a pending charge — then paid by
// card/PayPal; the abandoned EFT charge stayed pending forever).
//
//  PRE-migration:  leaks = every PAID order that still carries a `pending`
//                  charge. Expect > 0 if the bug has bitten (e.g. Petrus).
//  POST-migration: leaks should be 0 (the migration voids them), and every
//                  platform_ledger charge should carry order_id.
//
// Run from repo root: node scripts/verify-order-charge-reconcile.mjs
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

const money = (n) => `R${Number(n ?? 0).toFixed(2)}`;

async function main() {
  // Does the order_id column exist yet? (probe select)
  const probe = await supabase
    .from("platform_ledger")
    .select("id, order_id")
    .limit(1);
  const hasColumn = !probe.error;
  console.log(
    hasColumn
      ? "✅ platform_ledger.order_id column present (migration applied)"
      : "⏳ platform_ledger.order_id NOT present yet (migration not applied) — running ref-pattern diagnosis only",
  );

  // Pull every paid product_order + every charge, and correlate.
  const { data: paidOrders, error: oErr } = await supabase
    .from("product_orders")
    .select("id, product_name, payer_email, amount, currency, status, paid_at")
    .eq("status", "paid");
  if (oErr) throw new Error(`product_orders: ${oErr.message}`);

  const chargeCols =
    "id, provider, provider_reference, status, type, amount, currency, reason, user_id" +
    (hasColumn ? ", order_id" : "");
  const { data: charges, error: cErr } = await supabase
    .from("platform_ledger")
    .select(chargeCols)
    .eq("type", "charge");
  if (cErr) throw new Error(`platform_ledger: ${cErr.message}`);

  const paidIds = new Set((paidOrders ?? []).map((o) => o.id));

  // Link a charge to an order: prefer order_id; fall back to ref convention.
  const orderOf = (c) => {
    if (c.order_id) return c.order_id;
    const ref = c.provider_reference ?? "";
    const eft = ref.match(/^eft_(.+)$/);
    if (eft) return eft[1];
    const prod = ref.match(/^prod_(.+)_\d+$/);
    if (prod) return prod[1];
    return null; // PayPal id — only linkable via order_id
  };

  // LEAK = a pending charge belonging to a PAID order.
  const leaks = (charges ?? []).filter((c) => {
    if (c.status !== "pending") return false;
    const oid = orderOf(c);
    return oid && paidIds.has(oid);
  });

  console.log(
    `\n${leaks.length === 0 ? "✅" : "❌"} Paid orders carrying a phantom pending charge: ${leaks.length}`,
  );
  for (const c of leaks) {
    const o = (paidOrders ?? []).find((x) => x.id === orderOf(c));
    console.log(
      `   • order ${orderOf(c)?.slice(0, 8)} (${o?.payer_email ?? "?"}) — pending ${c.provider} ${money(c.amount)} [ref ${c.provider_reference}]`,
    );
  }

  // Post-migration integrity: every charge should carry order_id.
  if (hasColumn) {
    const unlinked = (charges ?? []).filter((c) => !c.order_id);
    console.log(
      `${unlinked.length === 0 ? "✅" : "⚠️ "} Charges without order_id: ${unlinked.length}${
        unlinked.length ? " (older rows a backfill couldn't match — informational)" : ""
      }`,
    );
  }

  console.log(
    `\nSummary: ${leaks.length === 0 ? "CLEAN — no paid order has an outstanding phantom charge." : "LEAKS PRESENT — apply the migration / load the host dashboard to heal."}`,
  );
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
