// Phase 1 (Guests CRM) schema probe — READ ONLY, service role.
// Confirms the extended host_contacts columns, the new guest_notes table,
// the user_profiles verification columns, and that starter templates seeded.
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
  await selectOk(
    "host_contacts extended cols",
    "host_contacts",
    "id, country, email_consent, blocked, blocked_reason, blocked_at, tags, notes",
  );
  await selectOk(
    "guest_notes table",
    "guest_notes",
    "id, host_id, gkey, author_id, body, is_pinned, created_at",
  );
  await selectOk(
    "user_profiles verification cols",
    "user_profiles",
    "id, phone_verified_at, id_verified_at, country",
  );
  await selectOk(
    "message_templates reused",
    "message_templates",
    "id, host_id, title, body, sort_order",
  );

  const { count } = await supabase
    .from("message_templates")
    .select("*", { count: "exact", head: true });
  log((count ?? 0) > 0, "starter templates seeded", `${count ?? 0} rows`);

  console.log(`\n${pass} passed · ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
