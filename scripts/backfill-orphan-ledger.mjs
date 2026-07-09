// One-time backfill: assign a user to every orphan platform_ledger row (user_id
// null). Resolves the order from the provider_reference (prod_<orderId>_<ts>);
// uses the order's payer_user_id, else creates a guest lead from payer_email
// (mirrors lib/enquiry/findOrCreateLeadIdentity). Service role. Run with node.
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

async function findOrCreateGuest(email, name) {
  const e = email.trim().toLowerCase();
  const { data: existing } = await db
    .from("user_profiles")
    .select("id")
    .ilike("email", e)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await db.auth.admin.createUser({
    email: e,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !created?.user) {
    console.error("  createUser failed", e, error?.message);
    return null;
  }
  await db
    .from("user_profiles")
    .update({ full_name: name, role: "guest", is_lead: true })
    .eq("id", created.user.id);
  return created.user.id;
}

const { data: orphans } = await db
  .from("platform_ledger")
  .select("id, provider_reference, user_id")
  .is("user_id", null);

console.log(`orphan ledger rows: ${orphans?.length ?? 0}`);
let fixed = 0;
for (const row of orphans ?? []) {
  const ref = row.provider_reference ?? "";
  const m = ref.match(/^(?:prod|eft)_(.*?)(?:_\d+)?$/);
  const orderId = m?.[1];
  if (!orderId) {
    console.log(`  skip ${row.id} — can't resolve order from "${ref}"`);
    continue;
  }
  const { data: order } = await db
    .from("product_orders")
    .select("id, payer_user_id, payer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    console.log(`  skip ${row.id} — order ${orderId} not found`);
    continue;
  }
  let userId = order.payer_user_id;
  if (!userId && order.payer_email) {
    userId = await findOrCreateGuest(
      order.payer_email,
      order.payer_email.split("@")[0],
    );
    if (userId) {
      await db
        .from("product_orders")
        .update({ payer_user_id: userId })
        .eq("id", order.id);
    }
  }
  if (!userId) {
    console.log(`  skip ${row.id} — no user + no email on order`);
    continue;
  }
  await db.from("platform_ledger").update({ user_id: userId }).eq("id", row.id);
  fixed++;
  console.log(`  fixed ${row.id} -> user ${userId} (${order.payer_email})`);
}
console.log(`done. fixed ${fixed}/${orphans?.length ?? 0}.`);
