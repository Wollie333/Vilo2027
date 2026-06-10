// Party-guests backfill probe — READ ONLY, service role.
// Finds bookings with a party manifest (additional_guests) and checks whether
// each named party member (name+email) has a host_contacts record and a
// guest_relationships link to the lead. Reports gaps for confirmed+ bookings.
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

const REALIZED = new Set([
  "confirmed",
  "checked_in",
  "completed",
  "checked_out",
]);

async function main() {
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(
      "id, host_id, status, reference, guest_email, additional_guests, deleted_at",
    )
    .not("additional_guests", "is", null);
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }

  const withParty = (rows ?? []).filter(
    (b) =>
      !b.deleted_at &&
      Array.isArray(b.additional_guests) &&
      b.additional_guests.some((g) => (g?.name ?? "").trim().length > 0),
  );

  console.log(`Bookings with a party manifest: ${withParty.length}\n`);
  if (withParty.length === 0) {
    console.log("Nothing to materialise. Done.");
    return;
  }

  let needBackfill = 0;
  let totalMembersWithEmail = 0;

  for (const b of withParty) {
    const members = b.additional_guests
      .map((g) => ({
        name: (g?.name ?? "").trim(),
        email: (g?.email ?? "").trim().toLowerCase(),
      }))
      .filter((g) => g.name && g.email);
    totalMembersWithEmail += members.length;

    // Which members already have a contact row?
    let contactsPresent = 0;
    for (const m of members) {
      const { data: c } = await supabase
        .from("host_contacts")
        .select("id")
        .eq("host_id", b.host_id)
        .ilike("email", m.email)
        .maybeSingle();
      if (c) contactsPresent += 1;
    }

    const { count: relCount } = await supabase
      .from("guest_relationships")
      .select("id", { count: "exact", head: true })
      .eq("source_booking_id", b.id);

    const realized = REALIZED.has(b.status);
    const missing =
      realized &&
      (contactsPresent < members.length || (members.length > 0 && !relCount));
    if (missing) needBackfill += 1;

    console.log(
      `${realized ? (missing ? "✗" : "✓") : "·"} ${b.reference} [${b.status}] ` +
        `party=${members.length} contacts=${contactsPresent}/${members.length} ` +
        `rels=${relCount ?? 0}${realized ? "" : "  (not confirmed — skipped)"}`,
    );
  }

  console.log(
    `\nParty members with email: ${totalMembersWithEmail}\n` +
      `Confirmed+ bookings needing backfill: ${needBackfill}`,
  );
  if (needBackfill > 0) {
    console.log(
      "\nRun the backfill migration to materialise these (idempotent).",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
