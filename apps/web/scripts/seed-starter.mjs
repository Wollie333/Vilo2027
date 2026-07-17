// Starter seed — the founder's 3 subscriber accounts, for real testing.
//
// TWO hosts, each a Beta subscriber with ONE fully set-up property and THREE
// rooms, plus ONE guest. Everything a host needs to be "complete": profile,
// business/legal details, banking, policies (cancellation + check-in/out +
// house rules + T&Cs), photos, amenities, rooms, and Wielo credits.
//
// It also seeds the little bit of real activity that makes the recently-wired
// features testable at all — a completed booking that earns a REVIEW (so the
// host's Report-review button has something to report) and a guest Looking-For
// POST (so the bookmark button has something to save).
//
// WHY TWO HOSTS: one host can't prove isolation. Two lets you see that host A
// never sees host B's data — the IDOR/RLS class of bug this project keeps
// finding is invisible with a single account.
//
// Runs against whatever apps/web/.env.local points at, with the service-role
// key (RLS bypassed). Re-runnable: every row has a fixed UUID and is upserted,
// and bookings only transition on first insert so status triggers can't
// double-fire.
//
//   node --env-file=.env.local scripts/seed-starter.mjs   # from apps/web
//
// Order is NOT arbitrary — two triggers dictate it:
//   * hosts INSERT fires trg_host_default_business + trg_seed_host_policies, so
//     the business and the whole policy set already exist by the time we look.
//   * properties INSERT fires enforce_listing_requires_bank, which RAISES unless
//     the host already has a default, unarchived bank account. Banking first.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run from apps/web with: node --env-file=.env.local scripts/seed-starter.mjs",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Logins ───────────────────────────────────────────────────────────────
const PASSWORD = "WieloStarter123!";
const HOST_A_EMAIL = "host1@wielostarter.com";
const HOST_B_EMAIL = "host2@wielostarter.com";
const GUEST_EMAIL = "guest@wielostarter.com";

// Beta: R0/month, plan_key 'business', product_type 'membership'. Read from the
// catalog rather than hardcoded — a seed that invents its own id is a seed that
// silently drifts from the product the host actually gets.
const BETA_SLUG = "beta";

// Mirrors lib/credits/wallet.ts's WIELO_CREDIT_PURPOSE. Kept as a named constant
// rather than a bare "quote" so it reads as the SSOT it is, not a magic string.
const WIELO_CREDIT_PURPOSE = "quote";

// ── Fixed UUIDs (v4-shaped). `0b…` namespace so we never collide with
//    seed-demo.mjs's `0a…` rows. ────────────────────────────────────────────
const HOST_A = "0b111111-1111-4111-8111-111111111101";
const HOST_B = "0b111111-1111-4111-8111-111111111102";
const BANK_A = "0b222222-2222-4222-8222-222222222201";
const BANK_B = "0b222222-2222-4222-8222-222222222202";
const SUB_A = "0b333333-3333-4333-8333-333333333301";
const SUB_B = "0b333333-3333-4333-8333-333333333302";
const PROP_A = "0b444444-4444-4444-8444-444444444401";
const PROP_B = "0b444444-4444-4444-8444-444444444402";
const BOOKING_A = "0b777777-7777-4777-8777-777777777701";
const BOOKING_B = "0b777777-7777-4777-8777-777777777702";
const REVIEW_A = "0b888888-8888-4888-8888-888888888801";
const LF_POST = "0b999999-9999-4999-8999-999999999901";

// Child-row ids. The host's SLOT ('01'/'02') is baked into every id, because
// PROP_A and PROP_B differ only in their last character — deriving a child id by
// slicing the property id made both hosts produce the SAME id, and host B's rows
// silently UPSERTED OVER host A's (host A ended up with zero rooms while the
// script printed success). Suffixes stay hex or the uuid is invalid.
const ROOM_STEM = "0b555555-5555-4555-8555-55555555";
const PHOTO_STEM = "0b666666-6666-4666-8666-66666666";
const AMEN_STEM = "0baaaaaa-aaaa-4aaa-8aaa-aaaaaaaa";
const roomId = (slot, i) => `${ROOM_STEM}${slot}c${i}`;
const photoId = (slot) => `${PHOTO_STEM}${slot}f0`;
const amenityId = (slot, i) => `${AMEN_STEM}${slot}a${i}`;

const nowIso = () => new Date().toISOString();
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

// ── Helpers (same shape as seed-demo.mjs — proven) ───────────────────────
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
  throw new Error(
    `Could not create or find auth user ${email}: ${error.message}`,
  );
}

// Per-row upsert: PostgREST builds ONE column set from the union of keys across
// an array and sends NULL (not DEFAULT) for keys a row omits, which trips NOT
// NULL columns. Row at a time lets each row's defaults apply.
async function up(table, rows, onConflict = "id") {
  for (const row of rows) {
    const { error } = await admin.from(table).upsert(row, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

async function rpc(fn, args) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}: ${error.message}`);
  return data;
}

async function defaultBusinessId(hostId) {
  const { data, error } = await admin
    .from("businesses")
    .select("id")
    .eq("host_id", hostId)
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw new Error(`select business: ${error.message}`);
  if (!data?.id) {
    throw new Error(
      `No default business for host ${hostId} — trg_host_default_business did not fire.`,
    );
  }
  return data.id;
}

// Insert as `pending`, then transition, so on_booking_confirmed + the invoice
// triggers fire the way they do in the real flow. Skipped entirely on re-run.
async function seedBooking(base, finalStatus) {
  const { data: exists } = await admin
    .from("bookings")
    .select("id")
    .eq("id", base.id)
    .maybeSingle();
  if (exists) return;

  const { error } = await admin
    .from("bookings")
    .insert({ ...base, status: "pending" });
  if (error) throw new Error(`insert booking ${base.id}: ${error.message}`);

  const step = async (patch) => {
    const { error: e } = await admin
      .from("bookings")
      .update(patch)
      .eq("id", base.id);
    if (e)
      throw new Error(`booking ${base.id} -> ${patch.status}: ${e.message}`);
  };

  await step({ status: "confirmed", confirmed_at: nowIso() });
  if (finalStatus === "completed") {
    await step({ status: "completed", checked_out_at: nowIso() });
  }
}

// ── The two hosts ────────────────────────────────────────────────────────
const HOSTS = [
  {
    slot: "01",
    id: HOST_A,
    email: HOST_A_EMAIL,
    bankId: BANK_A,
    subId: SUB_A,
    propId: PROP_A,
    profile: {
      full_name: "Thabo Nkosi",
      phone: "+27821110001",
    },
    host: {
      handle: "table-mountain-guest-house",
      display_name: "Table Mountain Guest House",
      bio: "A quiet guest house on the slopes, ten minutes from the cable car. Three rooms, big breakfasts, and the best stoep in Cape Town.",
      avatar_url:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200",
      cover_photo_url:
        "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200",
      languages_spoken: ["English", "isiZulu", "Afrikaans"],
      is_verified: true,
    },
    business: {
      legal_name: "Table Mountain Guest House (Pty) Ltd",
      trading_name: "Table Mountain Guest House",
      vat_number: "4550111222",
      company_registration_number: "2019/445566/07",
      address_line1: "18 Kloof Nek Road",
      city: "Cape Town",
      postal_code: "8001",
      country: "ZA",
    },
    bank: {
      account_holder: "Table Mountain Guest House (Pty) Ltd",
      account_number: "62511122233",
      bank_name: "FNB",
      branch_code: "250655",
      account_type: "business",
      label: "Primary",
    },
    property: {
      // Must be a key ACC_LABEL knows (hotel/guesthouse/bb/self_catering/lodge)
      // — anything else renders as the generic "Stay" rather than erroring.
      accommodation_type: "guesthouse",
      name: "Table Mountain Guest House",
      slug: "table-mountain-guest-house",
      description:
        "Three en-suite rooms on the slopes of Table Mountain. Breakfast on the stoep, secure parking, and the cable car ten minutes up the road.",
      city: "Cape Town",
      province: "Western Cape",
      country: "ZA",
      latitude: -33.9391,
      longitude: 18.4046,
      bedrooms: 3,
      bathrooms: 3,
      max_guests: 6,
      base_price: 1450,
      cleaning_fee: 250,
      // Rooms are sold individually here — the whole house is never one booking.
      booking_mode: "rooms_only",
      cancellation_policy: "moderate",
    },
    amenities: ["wifi", "parking", "breakfast_included", "pool"],
    rooms: [
      {
        name: "Lion's Head Room",
        description:
          "Queen en-suite facing Lion's Head. Wakes up with the sun.",
        bedrooms: 1,
        bathrooms: 1,
        max_guests: 2,
        base_price: 1450,
        cleaning_fee: 250,
        bed_type: "Queen",
        view_type: "Mountain",
      },
      {
        name: "Camps Bay Room",
        description: "Twin en-suite with a small balcony over the garden.",
        bedrooms: 1,
        bathrooms: 1,
        max_guests: 2,
        base_price: 1350,
        cleaning_fee: 250,
        bed_type: "Twin",
        view_type: "Garden",
      },
      {
        name: "The Stoep Suite",
        description:
          "King suite with a private stoep, sitting area and outdoor shower.",
        bedrooms: 1,
        bathrooms: 1,
        max_guests: 3,
        base_price: 2100,
        cleaning_fee: 350,
        bed_type: "King",
        view_type: "Mountain",
      },
    ],
    photo:
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200",
  },
  {
    slot: "02",
    id: HOST_B,
    email: HOST_B_EMAIL,
    bankId: BANK_B,
    subId: SUB_B,
    propId: PROP_B,
    profile: {
      full_name: "Elmarie van Wyk",
      phone: "+27821110002",
    },
    host: {
      handle: "drakensberg-mountain-lodge",
      display_name: "Drakensberg Mountain Lodge",
      bio: "Family lodge in the northern Berg. Hiking from the door, trout in the dam, and a fire every night of the year.",
      avatar_url:
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=200",
      cover_photo_url:
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200",
      languages_spoken: ["Afrikaans", "English"],
      is_verified: true,
    },
    business: {
      legal_name: "Berg Hospitality CC",
      trading_name: "Drakensberg Mountain Lodge",
      vat_number: "4550333444",
      company_registration_number: "2016/778899/23",
      address_line1: "Farm 12, Champagne Valley Road",
      city: "Winterton",
      postal_code: "3340",
      country: "ZA",
    },
    bank: {
      account_holder: "Berg Hospitality CC",
      account_number: "10199988877",
      bank_name: "Standard Bank",
      branch_code: "051001",
      account_type: "business",
      label: "Primary",
    },
    property: {
      accommodation_type: "lodge",
      name: "Drakensberg Mountain Lodge",
      slug: "drakensberg-mountain-lodge",
      description:
        "A three-room lodge in Champagne Valley. Book a room, or take the whole lodge for a family weekend. Hiking trails start at the gate.",
      city: "Winterton",
      province: "KwaZulu-Natal",
      country: "ZA",
      latitude: -28.9667,
      longitude: 29.4667,
      bedrooms: 3,
      bathrooms: 2,
      max_guests: 8,
      base_price: 1800,
      cleaning_fee: 400,
      // Deliberately DIFFERENT to host A: rooms OR the whole lodge. Two hosts on
      // one booking_mode would test half the pricing paths.
      booking_mode: "flexible",
      cancellation_policy: "strict",
      whole_property_discount_pct: 15,
      weekly_discount_pct: 10,
    },
    // Slugs must match amenity_catalog.slug exactly — the app resolves the key
    // against the catalog to render a label, so a wrong slug fails SILENTLY.
    // ("braai_bbq", used by all three older seed scripts, is not a real slug.)
    amenities: ["wifi", "parking", "fireplace", "braai", "pet_friendly"],
    rooms: [
      {
        name: "Cathkin Room",
        description: "King room looking straight at Cathkin Peak.",
        bedrooms: 1,
        bathrooms: 1,
        max_guests: 2,
        base_price: 1800,
        cleaning_fee: 400,
        bed_type: "King",
        view_type: "Mountain",
      },
      {
        name: "Champagne Room",
        description: "Queen room with a wood-burning stove.",
        bedrooms: 1,
        bathrooms: 1,
        max_guests: 2,
        base_price: 1650,
        cleaning_fee: 400,
        bed_type: "Queen",
        view_type: "Valley",
      },
      {
        name: "The Loft",
        description: "Family loft: one king and two singles under the eaves.",
        bedrooms: 1,
        bathrooms: 1,
        max_guests: 4,
        base_price: 2400,
        cleaning_fee: 500,
        bed_type: "King + 2 Single",
        view_type: "Valley",
      },
    ],
    photo:
      "https://images.unsplash.com/photo-1518602164578-cd0074062767?w=1200",
  },
];

// ── Seed ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding starter accounts into ${URL}\n`);

  // Read Beta from the catalog. plan comes from the product's plan_key, exactly
  // like switchToProductAction does — the plan FK must stay valid.
  const { data: beta, error: betaErr } = await admin
    .from("products")
    .select("id, plan_key, billing_cycle, price, is_active")
    .eq("slug", BETA_SLUG)
    .maybeSingle();
  if (betaErr) throw new Error(`read Beta product: ${betaErr.message}`);
  if (!beta)
    throw new Error(`No product with slug '${BETA_SLUG}' on this project.`);
  if (!beta.is_active) throw new Error("The Beta product is not active.");
  const betaPaid = Number(beta.price) > 0;
  console.log(
    `  Beta → plan '${beta.plan_key}', ${betaPaid ? "paid" : "R0"}, ${beta.billing_cycle}`,
  );

  const guestUser = await ensureAuthUser(GUEST_EMAIL, PASSWORD);
  const GUEST_UID = guestUser.id;
  await up("user_profiles", [
    {
      id: GUEST_UID,
      role: "guest",
      full_name: "Lerato Mahlangu",
      email: GUEST_EMAIL,
      phone: "+27829990001",
    },
  ]);
  console.log(`  guest  ${GUEST_EMAIL}`);

  for (const h of HOSTS) {
    const user = await ensureAuthUser(h.email, PASSWORD);

    await up("user_profiles", [
      { id: user.id, role: "host", email: h.email, ...h.profile },
    ]);

    // hosts INSERT → default business + the full policy set, via triggers.
    await up("hosts", [{ id: h.id, user_id: user.id, ...h.host }]);

    const businessId = await defaultBusinessId(h.id);
    const { error: bizErr } = await admin
      .from("businesses")
      .update(h.business)
      .eq("id", businessId);
    if (bizErr) throw new Error(`update business: ${bizErr.message}`);

    // MUST precede the property — enforce_listing_requires_bank raises without it.
    await up("eft_banking_details", [
      {
        id: h.bankId,
        host_id: h.id,
        business_id: businessId,
        is_default: true,
        ...h.bank,
      },
    ]);

    // ONE membership per host. A product-less `free` baseline ALSO counts as a
    // membership (forbid_second_active_membership), so seeding Beta *and* a
    // baseline would raise — Beta alone is the correct end state.
    await up("subscriptions", [
      {
        id: h.subId,
        host_id: h.id,
        product_id: beta.id,
        plan: beta.plan_key,
        billing_cycle: beta.billing_cycle === "annual" ? "annual" : "monthly",
        status: "active",
        trial_ends_at: null,
        current_period_start: nowIso(),
        // A free grant has no billing period — it never expires.
        current_period_end: null,
        cancel_at_period_end: false,
      },
    ]);

    await up("properties", [
      {
        id: h.propId,
        host_id: h.id,
        business_id: businessId,
        property_type: "accommodation",
        currency: "ZAR",
        check_in_time: "14:00",
        check_out_time: "10:00",
        accepts_paystack: true,
        accepts_eft: true,
        instant_booking: true,
        is_published: true,
        published_at: nowIso(),
        ...h.property,
      },
    ]);

    await up("property_photos", [
      {
        id: photoId(h.slot),
        property_id: h.propId,
        storage_path: `listing-photos/${h.propId}/cover.jpg`,
        url: h.photo,
        sort_order: 0,
        caption: h.property.name,
      },
    ]);

    await up(
      "property_amenities",
      h.amenities.map((key, i) => ({
        id: amenityId(h.slot, i),
        property_id: h.propId,
        amenity_key: key,
      })),
    );

    await up(
      "property_rooms",
      h.rooms.map((r, i) => ({
        id: roomId(h.slot, i),
        property_id: h.propId,
        currency: "ZAR",
        sort_order: i,
        is_active: true,
        ...r,
      })),
    );

    // Attach the host's policies (seeded by trigger above) to the property.
    await rpc("ensure_listing_policy_assignments", { p_listing_id: h.propId });

    // Wielo credits, so Looking-For leads AND quotes are spendable.
    // ONE wallet, deliberately: lib/credits/wallet.ts is explicit that seeing a
    // lead (1) and sending a quote (1) both draw on the SAME `quote` wallet —
    // "there is deliberately no second wallet". Granting a separate `lead` purpose
    // creates a balance nothing ever reads. Use the exported SSOT purpose.
    await rpc("apply_wielo_credit", {
      p_host_id: h.id,
      p_purpose: WIELO_CREDIT_PURPOSE,
      p_delta: 50,
      p_kind: "grant",
      p_reason: "Starter seed grant",
      p_ref_type: "seed",
      // The idempotency key EXCLUDES purpose, so a ref_id shared across purposes
      // would silently no-op the second grant — keep the purpose in the ref_id.
      p_ref_id: `starter-seed:${h.id}:${WIELO_CREDIT_PURPOSE}`,
    });

    console.log(
      `  host   ${h.email}  →  ${h.host.display_name} (${h.property.booking_mode}, 3 rooms)`,
    );
  }

  // ── Activity: enough for the newly-wired features to be testable ────────
  const [a, b] = HOSTS;

  // Host A: a past stay that COMPLETED → earns a review.
  await seedBooking(
    {
      id: BOOKING_A,
      property_id: a.propId,
      host_id: a.id,
      guest_id: GUEST_UID,
      guest_name: "Lerato Mahlangu",
      guest_email: GUEST_EMAIL,
      check_in: day(-12),
      check_out: day(-9),
      guests_count: 2,
      base_amount: 4350,
      cleaning_fee: 250,
      total_amount: 4600,
      currency: "ZAR",
      origin: "guest_request",
      scope: "rooms",
      payment_method: "paystack",
      payment_status: "completed",
    },
    "completed",
  );

  // The review the host can now actually Report (20260716330000 made the flag
  // path possible; this gives it a subject).
  await up("reviews", [
    {
      id: REVIEW_A,
      booking_id: BOOKING_A,
      property_id: a.propId,
      host_id: a.id,
      guest_id: GUEST_UID,
      rating: 4,
      body: "Lovely spot and a very warm welcome. The stoep at breakfast is worth the trip on its own. Marked down only because the road noise carries at night.",
      trip_type: "couples",
      rating_cleanliness: 5,
      rating_communication: 5,
      rating_checkin: 4,
      rating_accuracy: 4,
      rating_location: 5,
      rating_value: 4,
      is_published: true,
    },
  ]);

  // Host B: an upcoming confirmed stay, so the calendar/dashboard isn't empty.
  await seedBooking(
    {
      id: BOOKING_B,
      property_id: b.propId,
      host_id: b.id,
      guest_id: GUEST_UID,
      guest_name: "Lerato Mahlangu",
      guest_email: GUEST_EMAIL,
      check_in: day(21),
      check_out: day(24),
      guests_count: 2,
      base_amount: 5400,
      cleaning_fee: 400,
      total_amount: 5800,
      currency: "ZAR",
      origin: "guest_request",
      scope: "rooms",
      payment_method: "eft",
      payment_status: "pending",
    },
    "confirmed",
  );

  // A guest Looking-For request — the thing the host bookmark button saves.
  // Public so BOTH hosts see it on their board and can quote it.
  await up("looking_for_posts", [
    {
      id: LF_POST,
      guest_id: GUEST_UID,
      title: "Family weekend in the Berg, 2 adults + 2 kids",
      description:
        "Looking for a self-catering or B&B spot in the Drakensberg for a long weekend. Two adults, two kids (6 and 9). Hiking from the door would be ideal, and we'd love somewhere we can braai.",
      category: "accommodation",
      check_in_date: day(35),
      check_out_date: day(38),
      adults: 2,
      children: 2,
      infants: 0,
      location_text: "Champagne Valley, Drakensberg",
      location_region: "KwaZulu-Natal",
      search_radius_km: 50,
      budget_min: 1500,
      budget_max: 2500,
      budget_currency: "ZAR",
      budget_per: "night",
      is_urgent: false,
      is_public: true,
      status: "active",
    },
  ]);

  console.log("\n✅ Starter seed complete.\n");
  console.log(`   Host 1:  ${HOST_A_EMAIL}  / ${PASSWORD}`);
  console.log(`   Host 2:  ${HOST_B_EMAIL}  / ${PASSWORD}`);
  console.log(`   Guest:   ${GUEST_EMAIL} / ${PASSWORD}`);
  console.log(
    "\n   Each host: Beta subscriber · 1 published property · 3 rooms ·",
  );
  console.log("   business + banking + policies (cancellation, check-in/out,");
  console.log(
    "   house rules, T&Cs) · photos · amenities · 25 lead + 25 quote credits.",
  );
  console.log("   Plus: 1 completed booking + review (host 1), 1 upcoming");
  console.log("   booking (host 2), 1 guest Looking-For post.");
}

main().catch((err) => {
  console.error("\n❌ Starter seed failed:", err.message ?? err);
  process.exit(1);
});
