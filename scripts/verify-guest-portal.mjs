// One-off read-only verification sweep for the guest-portal + notification work.
// Validates the new query column names (limit(1) catches phantom columns / bad
// embeds) and confirms the new seed rows (notification category/event + help
// articles) exist on the live DB. Service role — READ ONLY, no writes.
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

async function selectOk(label, table, columns, tweak) {
  let q = supabase.from(table).select(columns).limit(1);
  if (tweak) q = tweak(q);
  const { error } = await q;
  log(!error, `${label}`, error?.message ?? "");
}

async function rowExists(label, table, col, val) {
  const { data, error } = await supabase
    .from(table)
    .select(col)
    .eq(col, val)
    .maybeSingle();
  log(!error && !!data, label, error?.message ?? (data ? "" : "not found"));
}

console.log("\n— Guest-portal query column validation —");
await selectOk(
  "quotes (list select)",
  "quotes",
  "id, quote_number, status, check_in, check_out, total_amount, currency, valid_until, created_at, listing:listings(name)",
);
await selectOk(
  "quotes (detail select)",
  "quotes",
  "id, quote_number, status, guest_name, check_in, check_out, headcount, base_amount, cleaning_fee, addons_total, total_amount, currency, notes, valid_until, conversation_id, listing:listings(name)",
);
await selectOk(
  "quote_addons",
  "quote_addons",
  "label, quantity, unit_price, subtotal",
);
await selectOk("quote_rooms", "quote_rooms", "quote_id, room_id, base_amount");
await selectOk(
  "bookings (overview book-again)",
  "bookings",
  "id, guests_count, listing:listings(name, slug)",
);
await selectOk(
  "in_app_notifications (bell)",
  "in_app_notifications",
  "id, kind, title, body, link, read_at, created_at, category_id, severity, payload",
);

console.log("\n— New notification taxonomy —");
await rowExists(
  "category quote_requests exists",
  "notification_categories",
  "id",
  "quote_requests",
);
await rowExists(
  "event quote_request_host exists",
  "notification_events",
  "kind",
  "quote_request_host",
);

console.log("\n— New help articles (published, guest) —");
for (const slug of [
  "view-and-accept-your-quotes",
  "message-a-host",
  "change-your-email-and-password",
]) {
  const { data, error } = await supabase
    .from("help_articles")
    .select("slug, status, audience, category_id")
    .eq("slug", slug)
    .maybeSingle();
  log(
    !error && data?.status === "published" && !!data?.category_id,
    `help: ${slug}`,
    error?.message ?? (data ? `status=${data.status}` : "not found"),
  );
}

console.log(`\n${pass} passed, ${fail} failed.\n`);
process.exit(fail ? 1 : 0);
