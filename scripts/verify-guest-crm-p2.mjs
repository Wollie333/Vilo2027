// Phase 2 (Guests CRM) RPC probe — READ ONLY, service role.
// Calls fetch_host_guests_summary / fetch_host_guests / fetch_guest_record
// against the host with the most bookings and sanity-checks the shapes/numbers.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(
  new URL("./.env.local", import.meta.url),
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

const j = (v) => JSON.stringify(v, null, 2);

async function main() {
  // Pick the host with the most bookings (most interesting demo data).
  const { data: hosts } = await supabase
    .from("bookings")
    .select("host_id")
    .is("deleted_at", null)
    .limit(2000);
  const counts = {};
  for (const r of hosts ?? []) counts[r.host_id] = (counts[r.host_id] ?? 0) + 1;
  const hostId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!hostId) {
    console.log("No bookings found — cannot probe.");
    process.exit(1);
  }
  console.log(`Probing host ${hostId} (${counts[hostId]} bookings)\n`);

  const { data: summary, error: sErr } = await supabase.rpc(
    "fetch_host_guests_summary",
    { p_host_id: hostId },
  );
  console.log("── summary ──", sErr?.message ?? "");
  console.log(j(summary));

  const { data: list, error: lErr } = await supabase.rpc("fetch_host_guests", {
    p_host_id: hostId,
    p_limit: 5,
  });
  console.log("\n── list (first 5) ──", lErr?.message ?? "");
  console.log("total_count:", list?.total_count);
  for (const g of list?.guests ?? []) {
    console.log(
      `  ${g.gkey.slice(0, 14)}… ${g.name ?? "—"} · stays=${g.total_stays} ltv=${g.lifetime_value} ` +
        `vip=${g.is_vip} ret=${g.is_returning} ota=${g.is_ota} inhouse=${g.is_inhouse} ` +
        `verified=${g.is_verified} email=${g.has_email} phone=${g.has_phone}`,
    );
  }

  const first = list?.guests?.[0];
  if (first) {
    const { data: rec, error: rErr } = await supabase.rpc(
      "fetch_guest_record",
      { p_host_id: hostId, p_gkey: first.gkey },
    );
    console.log(`\n── record for ${first.gkey} ──`, rErr?.message ?? "");
    console.log(j(rec));
  }

  // Segment + sort smoke
  for (const seg of ["vip", "returning", "new", "ota", "lapsed"]) {
    const { data } = await supabase.rpc("fetch_host_guests", {
      p_host_id: hostId,
      p_segment: seg,
      p_limit: 1,
    });
    console.log(`segment ${seg}: ${data?.total_count ?? "err"}`);
  }
}
main().then(() => process.exit(0));
