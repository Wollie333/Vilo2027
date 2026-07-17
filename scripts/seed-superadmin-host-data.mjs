// Seed full demo HOST data onto the super-admin account so the Website builder
// has real content to pull (rooms + photos, business details, policies, EFT,
// reviews). Service-role; idempotent — safe to re-run (upserts by stable keys).
//
// Run from repo root:  node scripts/seed-superadmin-host-data.mjs
// Requires apps/web/.env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
// Pre-launch demo data only (the DB gets wiped before launch).

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const env = {};
for (const line of readFileSync(
  new URL("../apps/web/.env.local", import.meta.url),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const EMAIL = "wollie@manamarketing.co.za";
const log = (...a) => console.log(...a);
const die = (msg, err) => {
  console.error("✖", msg, err?.message ?? err ?? "");
  process.exit(1);
};

// Stock imagery (Unsplash — siteImageUrl passes absolute URLs through unchanged).
const IMG = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// 3 rooms, 5 photos each (curated stock ids).
const ROOMS = [
  {
    name: "Garden Suite",
    description:
      "A light-filled suite opening onto the walled garden — a king bed, a deep tub, and a private stoep for slow mornings.",
    base_price: 2450,
    max_guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    bed_type: "King",
    room_size_sqm: 34,
    photos: [
      "1522708323590-d24dbb6b0267",
      "1560448204-e02f11c3d0e2",
      "1611892440504-42a792e24d32",
      "1505693416388-ac5ce068fe85",
      "1540518614846-7eded433c457",
    ],
  },
  {
    name: "Loft Room",
    description:
      "An upstairs loft with a kitchenette and a balcony over the treetops — the quiet one, tucked under the eaves.",
    base_price: 1950,
    max_guests: 3,
    bedrooms: 1,
    bathrooms: 1,
    bed_type: "Queen + single",
    room_size_sqm: 28,
    photos: [
      "1522771739844-6a9f6d5f14af",
      "1560185007-5f0bb1866cab",
      "1584132967334-10e028bd69f7",
      "1502672260266-1c1ef2d93688",
      "1556020685-ae41abfc9365",
    ],
  },
  {
    name: "River Cottage",
    description:
      "A self-contained cottage by the water — full kitchen, a fireplace for winter, and space for the whole family.",
    base_price: 3200,
    max_guests: 4,
    bedrooms: 2,
    bathrooms: 2,
    bed_type: "King + twin",
    room_size_sqm: 62,
    photos: [
      "1449824913935-59a10b8d2000",
      "1512917774080-9991f1c4c750",
      "1600585154340-be6161a56a0c",
      "1600607687939-ce8a6c25118c",
      "1600566753086-00f18fb6b3ea",
    ],
  },
];

// Property-wide gallery photos (room_id null).
const GALLERY = [
  "1571896349842-33c89424de2d",
  "1445019980597-93fa8acb246c",
  "1582719508461-905c673771fd",
  "1540541338287-41700207dee6",
];

const REVIEWS = [
  {
    guest: "Thandi Mokoena",
    email: "thandi.demo@wielo.test",
    rating: 5,
    body: "The most restful weekend we've had in years. Every detail was considered — from the coffee to the quiet. We're already planning the next stay.",
    days_ago: 26,
  },
  {
    guest: "Pieter van Wyk",
    email: "pieter.demo@wielo.test",
    rating: 5,
    body: "Spotless, characterful, and the host went out of her way for us. Booking direct was effortless and the rate beat every platform.",
    days_ago: 54,
  },
  {
    guest: "Aisha Khan",
    email: "aisha.demo@wielo.test",
    rating: 4,
    body: "Beautiful spot and a warm welcome. Bring a jersey — the nights get cold — but the fireplace more than makes up for it.",
    days_ago: 92,
  },
];

async function main() {
  // 1) Resolve the super-admin user.
  const { data: profile, error: pErr } = await db
    .from("user_profiles")
    .select("id, full_name")
    .eq("email", EMAIL)
    .maybeSingle();
  if (pErr) die("looking up user_profiles", pErr);
  if (!profile) die(`no user_profiles row for ${EMAIL} — sign in once first to create it.`);
  const userId = profile.id;
  log("• user:", EMAIL, userId);

  // 2) Find or create the host (creating one auto-seeds the default business +
  //    cancellation policies via triggers).
  let { data: host } = await db
    .from("hosts")
    .select("id, display_name")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) {
    const handle = "stillwater-house";
    const { data: h, error } = await db
      .from("hosts")
      .insert({
        user_id: userId,
        handle,
        display_name: "Stillwater House",
        default_currency: "ZAR",
        is_active: true,
      })
      .select("id, display_name")
      .single();
    if (error) die("creating host", error);
    host = h;
    log("• host: created", host.id);
  } else {
    log("• host: exists", host.id);
  }
  const hostId = host.id;

  // 3) Default business → fill in business details.
  const { data: biz, error: bErr } = await db
    .from("businesses")
    .select("id")
    .eq("host_id", hostId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (bErr) die("looking up default business", bErr);
  if (!biz) die("no default business for host (trigger should have created one)");
  const businessId = biz.id;
  await db
    .from("businesses")
    .update({
      legal_name: "Stillwater House (Pty) Ltd",
      trading_name: "Stillwater House",
      vat_number: "4123456789",
      company_registration_number: "2019/123456/07",
      address_line1: "12 Mill Road",
      city: "Nieu-Bethesda",
      province: "Eastern Cape",
      postal_code: "6286",
      country: "ZA",
      default_currency: "ZAR",
      default_language: "en",
    })
    .eq("id", businessId);
  log("• business: details set", businessId);

  // 4) Property (accommodation) — find-or-create by slug.
  const slug = "stillwater-house";
  let { data: prop } = await db
    .from("properties")
    .select("id")
    .eq("host_id", hostId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  const propFields = {
    host_id: hostId,
    business_id: businessId,
    property_type: "accommodation",
    accommodation_type: "guesthouse",
    name: "Stillwater House",
    slug,
    description:
      "Three restored rooms on the edge of the reserve — wide skies, slow mornings, and the bush at your door. Booked direct, no platform fees.",
    booking_mode: "rooms_only",
    cancellation_policy: "moderate",
    city: "Nieu-Bethesda",
    province: "Eastern Cape",
    country: "ZA",
    max_guests: 4,
    bedrooms: 4,
    bathrooms: 4,
    base_price: 1950,
    currency: "ZAR",
    is_published: true,
    is_suspended: false,
  };
  if (!prop) {
    const { data: p, error } = await db
      .from("properties")
      .insert(propFields)
      .select("id")
      .single();
    if (error) die("creating property", error);
    prop = p;
    log("• property: created", prop.id);
  } else {
    await db.from("properties").update(propFields).eq("id", prop.id);
    log("• property: updated", prop.id);
  }
  const propertyId = prop.id;

  // 5) Rooms + 6) photos.
  for (let i = 0; i < ROOMS.length; i++) {
    const r = ROOMS[i];
    let { data: room } = await db
      .from("property_rooms")
      .select("id")
      .eq("property_id", propertyId)
      .eq("name", r.name)
      .is("deleted_at", null)
      .maybeSingle();
    const roomFields = {
      property_id: propertyId,
      name: r.name,
      description: r.description,
      base_price: r.base_price,
      currency: "ZAR",
      max_guests: r.max_guests,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      bed_type: r.bed_type,
      room_size_sqm: r.room_size_sqm,
      sort_order: i,
      is_active: true,
    };
    if (!room) {
      const { data: rm, error } = await db
        .from("property_rooms")
        .insert(roomFields)
        .select("id")
        .single();
      if (error) die(`creating room ${r.name}`, error);
      room = rm;
    } else {
      await db.from("property_rooms").update(roomFields).eq("id", room.id);
    }
    // Reset this room's photos, then seed 5.
    await db.from("property_photos").delete().eq("room_id", room.id);
    const rows = r.photos.map((id, j) => ({
      property_id: propertyId,
      room_id: room.id,
      url: IMG(id),
      storage_path: `external/unsplash/${id}`,
      sort_order: j,
      caption: `${r.name} — ${j + 1}`,
    }));
    const { error: phErr } = await db.from("property_photos").insert(rows);
    if (phErr) die(`photos for ${r.name}`, phErr);
    log(`• room: ${r.name} + ${rows.length} photos`);
  }

  // Property-wide gallery photos (room_id null) — reset + seed.
  await db
    .from("property_photos")
    .delete()
    .eq("property_id", propertyId)
    .is("room_id", null);
  await db.from("property_photos").insert(
    GALLERY.map((id, j) => ({
      property_id: propertyId,
      url: IMG(id),
      storage_path: `external/unsplash/${id}`,
      sort_order: j,
      caption: `Stillwater House — ${j + 1}`,
    })),
  );
  log(`• gallery: ${GALLERY.length} property photos`);

  // 7) Policies — check_in_out + house_rules with content, then assign all
  //    (incl. the default cancellation) to the property. Cancellation presets are
  //    auto-seeded on host create.
  const { data: cancel } = await db
    .from("policies")
    .select("id")
    .eq("host_id", hostId)
    .eq("type", "cancellation")
    .eq("is_default", true)
    .eq("status", "active")
    .maybeSingle();

  async function ensureTextPolicy(type, name, bodyHtml, extra = {}) {
    let { data: pol } = await db
      .from("policies")
      .select("id")
      .eq("host_id", hostId)
      .eq("type", type)
      .is("deleted_at", null)
      .maybeSingle();
    if (!pol) {
      const { data: p, error } = await db
        .from("policies")
        .insert({ host_id: hostId, name, type, status: "active", is_default: true, ...extra })
        .select("id")
        .single();
      if (error) die(`creating ${type} policy`, error);
      pol = p;
    } else {
      await db.from("policies").update({ name, status: "active", ...extra }).eq("id", pol.id);
    }
    // upsert body content (locale en)
    await db.from("policy_content").delete().eq("policy_id", pol.id).eq("locale", "en");
    await db
      .from("policy_content")
      .insert({ policy_id: pol.id, locale: "en", body_html: bodyHtml });
    return pol.id;
  }

  const checkInId = await ensureTextPolicy(
    "check_in_out",
    "Check-in & check-out",
    "<p>Check-in from <strong>14:00</strong>, check-out by <strong>10:00</strong>. Self check-in with a smart lock — we'll send the code the morning of arrival. Early check-in / late check-out on request, subject to availability.</p>",
    { check_in_time: "14:00", check_out_time: "10:00" },
  );
  const houseRulesId = await ensureTextPolicy(
    "house_rules",
    "House rules",
    "<ul><li>No smoking indoors</li><li>Quiet hours after 22:00</li><li>Well-behaved dogs welcome in the River Cottage (please tell us in advance)</li><li>Please treat the garden and the water gently</li></ul>",
  );

  // Assign to the property (property_policies), idempotent per (property, type).
  async function assign(policyId, policyType) {
    if (!policyId) return;
    const { data: ex } = await db
      .from("property_policies")
      .select("id")
      .eq("property_id", propertyId)
      .eq("policy_type", policyType)
      .is("room_id", null)
      .maybeSingle();
    if (ex) {
      await db.from("property_policies").update({ policy_id: policyId }).eq("id", ex.id);
    } else {
      await db
        .from("property_policies")
        .insert({ property_id: propertyId, policy_id: policyId, policy_type: policyType });
    }
  }
  await assign(cancel?.id, "cancellation");
  await assign(checkInId, "check_in_out");
  await assign(houseRulesId, "house_rules");
  log("• policies: cancellation + check-in/out + house rules assigned");

  // 8) EFT banking — one default account per business.
  {
    const { data: ex } = await db
      .from("eft_banking_details")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_archived", false)
      .eq("is_default", true)
      .maybeSingle();
    const fields = {
      host_id: hostId,
      business_id: businessId,
      label: "Primary",
      account_holder: "Stillwater House (Pty) Ltd",
      bank_name: "First National Bank",
      account_number: "62812345678",
      branch_code: "250655",
      account_type: "cheque",
      is_default: true,
      is_archived: false,
    };
    if (ex) {
      await db.from("eft_banking_details").update(fields).eq("id", ex.id);
    } else {
      const { error } = await db.from("eft_banking_details").insert(fields);
      if (error) die("creating EFT banking details", error);
    }
    log("• EFT: banking details set");
  }

  // 9) Reviews (native, booking-backed). Each needs a guest + a completed booking.
  for (const rv of REVIEWS) {
    // Guest auth user (find or create).
    let guestId = null;
    const { data: gp } = await db
      .from("user_profiles")
      .select("id")
      .eq("email", rv.email)
      .maybeSingle();
    if (gp) {
      guestId = gp.id;
    } else {
      const { data: created, error } = await db.auth.admin.createUser({
        email: rv.email,
        email_confirm: true,
        user_metadata: { full_name: rv.guest },
      });
      if (error) die(`creating guest ${rv.email}`, error);
      guestId = created.user.id;
      // handle_new_user seeds user_profiles; make sure full_name is set.
      await db.from("user_profiles").update({ full_name: rv.guest }).eq("id", guestId);
    }

    // One booking per guest for this property (find by guest+property).
    let { data: bk } = await db
      .from("bookings")
      .select("id")
      .eq("property_id", propertyId)
      .eq("guest_id", guestId)
      .maybeSingle();
    if (!bk) {
      const { data: b, error } = await db
        .from("bookings")
        .insert({
          property_id: propertyId,
          host_id: hostId,
          guest_id: guestId,
          guest_name: rv.guest,
          guest_email: rv.email,
          status: "completed",
          base_amount: 2450,
          total_amount: 2450,
          currency: "ZAR",
          guests_count: 2,
        })
        .select("id")
        .single();
      if (error) die(`creating booking for ${rv.guest}`, error);
      bk = b;
    }

    // Review (one per booking; booking_id is unique).
    const { data: exRev } = await db
      .from("reviews")
      .select("id")
      .eq("booking_id", bk.id)
      .maybeSingle();
    const created_at = new Date(Date.now() - rv.days_ago * 86400000).toISOString();
    const revFields = {
      booking_id: bk.id,
      property_id: propertyId,
      host_id: hostId,
      guest_id: guestId,
      rating: rv.rating,
      body: rv.body,
      is_published: true,
      created_at,
    };
    if (exRev) {
      await db.from("reviews").update(revFields).eq("id", exRev.id);
    } else {
      const { error } = await db.from("reviews").insert(revFields);
      if (error) die(`creating review for ${rv.guest}`, error);
    }
    log(`• review: ${rv.guest} (${rv.rating}★)`);
  }

  log("\n✓ Done. Super-admin host now has: business details, 3 rooms (5 photos each) + gallery, policies, EFT, 3 reviews.");
  log("  Run the Website wizard for this business to pull it all in.");
}

main().catch((e) => die("unexpected", e));
