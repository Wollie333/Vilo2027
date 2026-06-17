// Reset the linked Supabase project to a clean slate for testing, KEEPING ONLY
// super-admin accounts. Every other user (hosts + guests) is hard-purged via
// the tested app_purge_user_account() teardown RPC, then auth.admin.deleteUser
// cascades user_profiles + the rest of the CASCADE graph.
//
// Platform CONFIG/REFERENCE data (plans, plan_features, property_categories,
// help_*, platform_settings, amenity_catalog, fx_rates, etc.) is left intact —
// only USER data (hosts, guests, listings, bookings, payments, quotes,
// conversations, reviews, …) tied to deleted users is removed.
//
// SAFE BY DEFAULT: prints a dry-run plan and changes nothing. Pass --commit to
// actually delete.
//
//   node --env-file=.env.local scripts/reset-keep-superadmin.mjs            # dry run
//   node --env-file=.env.local scripts/reset-keep-superadmin.mjs --commit   # execute

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMMIT = process.argv.includes("--commit");

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run from apps/web with: node --env-file=.env.local scripts/reset-keep-superadmin.mjs",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. Enumerate every auth user ────────────────────────────────────────
async function listAllAuthUsers() {
  const all = [];
  let page = 1;
  // listUsers paginates; 200/page is the max.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 200) break;
    page += 1;
  }
  return all;
}

// ── 2. Role lookup from user_profiles ───────────────────────────────────
async function fetchProfiles() {
  const map = new Map();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await admin
      .from("user_profiles")
      .select("id, email, role, full_name")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`user_profiles read failed: ${error.message}`);
    for (const p of data) map.set(p.id, p);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function main() {
  console.log(`\nProject: ${URL}`);
  console.log(`Mode:    ${COMMIT ? "COMMIT (will delete)" : "DRY RUN (no changes)"}\n`);

  const [users, profiles] = await Promise.all([
    listAllAuthUsers(),
    fetchProfiles(),
  ]);

  const keep = [];
  const remove = [];
  for (const u of users) {
    const prof = profiles.get(u.id);
    const role = prof?.role ?? null;
    const row = {
      id: u.id,
      email: u.email ?? prof?.email ?? "(no email)",
      role: role ?? "(no profile)",
    };
    if (role === "super_admin") keep.push(row);
    else remove.push(row);
  }

  console.log(`KEEP — super admins (${keep.length}):`);
  for (const k of keep) console.log(`   ✓ ${k.email}   [${k.role}]`);
  console.log(`\nDELETE — all other users (${remove.length}):`);
  for (const r of remove) console.log(`   ✗ ${r.email}   [${r.role}]`);
  console.log("");

  if (keep.length === 0) {
    console.error(
      "ABORT: no super_admin found — refusing to delete every user. " +
        "Set a user's user_profiles.role to 'super_admin' first.",
    );
    process.exit(1);
  }

  if (!COMMIT) {
    console.log("Dry run only. Re-run with --commit to delete the above.\n");
    return;
  }

  let ok = 0;
  const failures = [];
  for (const r of remove) {
    // 1) Purge every RESTRICT dependent (as guest + as host), 2) delete auth
    // user → cascades user_profiles + CASCADE children.
    const { error: purgeErr } = await admin.rpc("app_purge_user_account", {
      p_user_id: r.id,
    });
    if (purgeErr) {
      failures.push({ email: r.email, step: "purge", msg: purgeErr.message });
      continue;
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(r.id);
    if (delErr) {
      failures.push({ email: r.email, step: "deleteUser", msg: delErr.message });
      continue;
    }
    ok += 1;
    console.log(`   deleted ${r.email}`);
  }

  console.log(`\nDone. Deleted ${ok}/${remove.length} users.`);
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures)
      console.log(`   ! ${f.email} (${f.step}): ${f.msg}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
