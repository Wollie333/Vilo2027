// Seed a 2nd, NON-super-admin staff account (Finance role) so role-scoped admin
// behaviour can be tested: role-scoped notifications, permission boundaries, and
// that a finance user (who CAN settle payouts) receives payout pings while a
// non-finance role would not. Idempotent (upserts by fixed id / email).
//
//   node --env-file=.env.local scripts/seed-staff-finance.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error(
    "Run from apps/web with: node --env-file=.env.local scripts/seed-staff-finance.mjs",
  );
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "finance@wielodemo.com";
const PASSWORD = "WieloDemo123!";

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function ensureAuthUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return data.user;
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  throw new Error(`Could not create/find ${email}: ${error.message}`);
}

const user = await ensureAuthUser(EMAIL, PASSWORD);

const { error: profErr } = await admin.from("user_profiles").upsert(
  {
    id: user.id,
    role: "staff",
    full_name: "Fatima Finance",
    email: EMAIL,
    email_verified_at: new Date().toISOString(),
  },
  { onConflict: "id" },
);
if (profErr) throw new Error(`user_profiles: ${profErr.message}`);

const { error: staffErr } = await admin.from("platform_staff").upsert(
  {
    user_id: user.id,
    role_id: "finance",
    is_active: true,
    accepted_at: new Date().toISOString(),
  },
  { onConflict: "user_id" },
);
if (staffErr) throw new Error(`platform_staff: ${staffErr.message}`);

console.log("✓ Finance staff account ready:");
console.log(`   email:    ${EMAIL}`);
console.log(`   password: ${PASSWORD}`);
console.log(`   role:     finance (settles payouts; receives payout pings)`);
console.log(`   user_id:  ${user.id}`);
