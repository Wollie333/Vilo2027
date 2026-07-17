// Seed a FULL demo host — a Sabi Sand safari lodge — onto an existing account.
// Built so the website/builder feature has real data to render: a published
// listing with a photo gallery, 3 priced rooms each with their own gallery,
// policies, real bookings, published reviews and live specials.
//
// Idempotent: every row is keyed by a stable slug/reference and skipped if it
// already exists, so re-running only fills gaps. Pre-launch demo data only.
//
// Run from repo root:
//   node scripts/seed-demo-host.mjs [email]
// Defaults to wollie@manamarketing.co.za.
//
// IMAGES — real, licensed, and uploaded (not hot-linked):
// Photos are resolved from Wikimedia Commons by exact file title, downloaded,
// then uploaded into the `listing-photos` bucket, so they live in the HOST's own
// media library (dashboard/media reads property_photos) rather than depending on
// a third party staying up. Every file is CC BY / CC BY-SA / CC0 and its
// attribution is written into property_photos.caption.
//
// Commons rate-limits hard and returns a small HTML error page instead of an
// image when it throttles — so every download is validated as a real JPEG over
// 40KB before it is uploaded. (A 2KB "photo" is an error page, not a picture.)
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

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// `node scripts/seed-demo-host.mjs [email] [--reset]`
// --reset wipes THIS property's rooms + photos (DB rows AND storage objects)
// before rebuilding, so a half-finished or hand-edited state becomes an exact,
// predictable demo. The property row itself (and its bookings/reviews/specials)
// is preserved. Safe pre-launch: there is no real data to lose.
const ARGS = process.argv.slice(2);
const RESET = ARGS.includes("--reset");
const EMAIL = ARGS.find((a) => !a.startsWith("--")) || "wollie@manamarketing.co.za";
const UA = "WieloDemoSeed/1.0 (https://wielo.co.za; pre-launch demo seed)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// ─── Commons image resolution ────────────────────────────────────
const commonsCache = new Map();

async function commonsInfo(titles) {
  const missing = titles.filter((t) => !commonsCache.has(t));
  for (let i = 0; i < missing.length; i += 20) {
    const batch = missing.slice(i, i + 20);
    const url =
      "https://commons.wikimedia.org/w/api.php?format=json&action=query" +
      `&titles=${encodeURIComponent(batch.join("|"))}` +
      "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600";
    let j = null;
    for (let t = 0; t < 4 && !j; t++) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": UA } });
        if (r.ok) j = await r.json();
      } catch {
        await sleep(900 * (t + 1));
      }
    }
    const pages = j?.query?.pages ?? {};
    for (const k of Object.keys(pages)) {
      const p = pages[k];
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl) continue;
      commonsCache.set(p.title, {
        url: ii.thumburl,
        licence: ii.extmetadata?.LicenseShortName?.value ?? "CC",
        artist: (ii.extmetadata?.Artist?.value ?? "")
          .replace(/<[^>]*>/g, "")
          .trim()
          .slice(0, 80),
        descUrl: ii.descriptionurl,
      });
    }
    await sleep(300);
  }
  return titles.map((t) => commonsCache.get(t) ?? null);
}

async function fetchImage(url) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      const b = Buffer.from(await r.arrayBuffer());
      // A throttled Commons returns a tiny HTML page with a 200 — validate the
      // JPEG magic bytes AND a sane size rather than trusting the status code.
      if (b[0] === 0xff && b[1] === 0xd8 && b.length > 40000) return b;
    } catch {
      /* retry */
    }
    await sleep(1200 * (t + 1));
  }
  return null;
}

/**
 * Download a Commons photo and upload it into `listing-photos`, then attach it
 * to the property (and optionally a room) via property_photos. Skips instantly
 * if that storage path already exists, so re-runs cost nothing.
 */
async function attachPhoto({ propertyId, roomId, title, key, sort, caption }) {
  const path = `${propertyId}/${key}.jpg`;
  const { data: existing } = await db
    .from("property_photos")
    .select("id")
    .eq("storage_path", path)
    .maybeSingle();
  if (existing) return { skipped: true };

  const [info] = await commonsInfo([title]);
  if (!info) {
    log("   ! could not resolve:", title);
    return { failed: true };
  }
  const bytes = await fetchImage(info.url);
  if (!bytes) {
    log("   ! download failed (throttled?):", title.slice(5, 50));
    return { failed: true };
  }

  const up = await db.storage
    .from("listing-photos")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (up.error) {
    log("   ! upload failed:", up.error.message);
    return { failed: true };
  }
  const {
    data: { publicUrl },
  } = db.storage.from("listing-photos").getPublicUrl(path);

  const credit = `${caption} · Photo: ${info.artist || "Wikimedia Commons"} (${info.licence})`;
  const { error } = await db.from("property_photos").insert({
    property_id: propertyId,
    room_id: roomId ?? null,
    storage_path: path,
    url: publicUrl,
    sort_order: sort,
    caption: credit.slice(0, 300),
  });
  if (error) {
    log("   ! photo row failed:", error.message);
    return { failed: true };
  }
  await sleep(250);
  return { ok: true };
}

// ─── Content ─────────────────────────────────────────────────────
const SLUG = "mana-bush-lodge";

const LISTING_DESCRIPTION = `Mana Bush Lodge sits on 240 hectares of private big-game country on the western
edge of the Kruger, twenty minutes from Phabeni Gate and an hour from Kruger Mpumalanga International.
There is no fence between the lodge and the reserve, so elephant drift through the marula trees below the
deck most afternoons and hyena call across the riverbed at night.

The lodge was built in 1998 around a stand of leadwoods and rebuilt in 2023 with the same thatch, the same
stone and considerably better plumbing. There are only three suites, which is deliberate: at full capacity
there are eight guests and two guides, so the game drives never convoy and dinner never needs a second
sitting.

Days start at 05:30 with coffee and rusks at the fire, then a four-hour drive in an open Land Cruiser with
a tracker on the bonnet. The Big Five are all resident — the leopard density along the Sand River drainage
is among the highest in South Africa — but the guiding here is just as happy spending forty minutes with a
dung beetle. Brunch is at eleven, the middle of the day is yours for the plunge pools and the hide, and the
afternoon drive runs from four until well after dark.

Dinner is served in the boma under the fig tree or on the main deck, depending on the wind. The kitchen
cooks South African food properly: potjie, braaied kudu loin, malva pudding, and bread baked in the coals
every morning. Bring binoculars, a warm jacket for winter drives (it is genuinely cold at 05:30 in July)
and nothing else you would not want covered in dust.`;

const HOUSE_RULES = `No unaccompanied walking after dark — the lodge is unfenced and the walk to your suite is escorted by a
guide with a torch. Children over 8 are welcome on game drives; under-8s can be accommodated with a private
vehicle by arrangement. Quiet from 22:00 in the main areas so the night sounds win. Please do not feed the
nyala or the resident warthog, however convincingly he asks. Drones may not be flown over the reserve.
Smoking outdoors only, and never in the bush during fire season (August–October).`;

const WHAT_TO_BRING = `Binoculars, a wide-brimmed hat, sunblock and neutral-coloured clothing (khaki, olive, grey — not white, not
black, and not blue, which attracts tsetse). A properly warm jacket, beanie and gloves for winter morning
drives. Closed walking shoes. Any chronic medication — the nearest pharmacy is 40 minutes away. A camera
with more memory than you think you need.`;

const ROOMS = [
  {
    key: "leadwood",
    name: "Leadwood Suite",
    base_price: 4850,
    weekend_price: 5400,
    cleaning_fee: 0,
    max_guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    bed_type: "King",
    view_type: "Riverbed",
    room_size_sqm: 62,
    has_ensuite_bathroom: true,
    private_entrance: true,
    description: `The original suite, built into the roots of the leadwood the lodge is named after. A king bed under a
mosquito net faces east through a full wall of glass, so you wake with the sun coming up over the riverbed
without getting out of bed. The bathroom is open to the thatch with a stone bath and a separate outdoor
shower screened by a reed wall — nyala walk past it most mornings, entirely unbothered.

Its own deck holds a plunge pool kept at 26°C year-round and two loungers angled at the game path. Sixty-two
square metres, one bedroom, and no adjoining rooms: this is the quietest suite on the property and the one
photographers ask for, because the light in the afternoon is extraordinary.`,
    photos: [
      { i: 0, cap: "King bed under the net, facing the riverbed" },
      { i: 2, cap: "Private plunge pool on the Leadwood deck" },
      { i: 15, cap: "Writing desk and four-poster bed" },
      { i: 5, cap: "The suite's own deck at first light" },
      { i: 19, cap: "The star-bed platform, made up for the night" },
    ],
  },
  {
    key: "marula",
    name: "Marula Family Suite",
    base_price: 6200,
    weekend_price: 6900,
    cleaning_fee: 0,
    max_guests: 4,
    bedrooms: 2,
    bathrooms: 2,
    bed_type: "King + 2 Singles",
    view_type: "Waterhole",
    room_size_sqm: 96,
    has_ensuite_bathroom: true,
    private_entrance: true,
    description: `Two bedrooms under one thatch, connected by a shared lounge — built for families who want the children close
but not underfoot. The main bedroom has a king; the second has two singles that convert to a king, its own
bathroom and a door that actually closes properly, which parents notice.

The suite looks down on the waterhole from twelve metres up, which is the right distance: close enough that
you hear elephant drinking at two in the morning, far enough that nobody needs to whisper. Ninety-six square
metres with a wraparound deck, a plunge pool and a day bed that has ended more than one game drive early.

Children over 8 are welcome. We keep a box of field guides, a butterfly net and a decent pair of junior
binoculars in the lounge, and the guides will happily turn a morning drive into a tracking lesson.`,
    photos: [
      { i: 6, cap: "Second bedroom — twin beds with bush views" },
      { i: 9, cap: "Main bedroom, open to the deck" },
      { i: 10, cap: "Plunge pool beneath the thatch" },
      { i: 17, cap: "Sundowners on the family deck" },
      { i: 24, cap: "Private dining on the deck" },
    ],
  },
  {
    key: "tamboti",
    name: "Tamboti Star-Bed Suite",
    base_price: 5400,
    weekend_price: 6100,
    cleaning_fee: 0,
    max_guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    bed_type: "King + star bed",
    view_type: "Bushveld",
    room_size_sqm: 70,
    has_ensuite_bathroom: true,
    private_entrance: true,
    description: `The suite people book again. Downstairs is a conventional (and very good) bedroom in tamboti and stone, with
a king bed, a deep bath and a shower with a window onto the bush. Upstairs, reached by a short wooden stair,
is the reason it exists: a netted star bed on an open rooftop platform, made up fresh every evening with hot
water bottles in winter.

Sleeping out is entirely optional and about ninety percent of guests do it anyway. You are ten metres up,
under a mosquito net, with nothing between you and the Milky Way — and the Southern Cross sits directly
overhead from April to June. A guide is on call by radio all night, though in twenty-six years nobody has
needed to use it for anything more dramatic than a curious genet.

Seventy square metres, purple-tinged tamboti throughout, and the best acoustics on the property: the lions
on the northern boundary sound like they are in the room.`,
    photos: [
      { i: 13, cap: "The downstairs bedroom in tamboti and stone" },
      { i: 21, cap: "Bath and bedroom under thatch" },
      { i: 18, cap: "Looking through to the deck" },
      { i: 23, cap: "The lounge, late afternoon" },
      { i: 11, cap: "Main lodge lounge under the thatch" },
    ],
  },
];

const LISTING_PHOTOS = [
  { i: 12, cap: "Mana Bush Lodge from the waterhole" },
  { i: 1, cap: "The main lounge and its fireplace" },
  { i: 14, cap: "The deck at sunset" },
  { i: 16, cap: "Dinner in the boma" },
  { i: 20, cap: "Morning game drive vehicle" },
  { i: 0, cap: "Inside the Leadwood Suite" },
];

const SPECIALS = [
  {
    slug: "mana-stay-4-pay-3",
    title: "Stay 4, Pay 3 — Green Season",
    badge: "25% off",
    description: `Four nights for the price of three between January and March, when the bush is green, the impala are
lambing and the photography is at its best. Includes all meals, two game drives a day and the Sand River
sundowner stop. The rate applies to any suite; the fourth night is deducted at checkout.`,
    price_mode: "per_night",
    per_night_price: 3640,
    was_price: 4850,
    min_nights: 4,
    photo: 14,
    photoCap: "Green season on the deck",
  },
  {
    slug: "mana-honeymoon-star-bed",
    title: "Honeymoon Under the Stars",
    badge: "Couples",
    description: `Three nights in the Tamboti Star-Bed Suite with a private boma dinner, a bush breakfast on the riverbed
and a bottle of MCC on the star-bed deck the night you arrive. Late checkout at 14:00. Available to couples
travelling on a verified honeymoon within twelve months of the wedding date.`,
    price_mode: "flat",
    flat_total: 18500,
    was_price: 22200,
    min_nights: 3,
    photo: 19,
    photoCap: "The star bed, made up at dusk",
  },
  {
    slug: "mana-locals-midweek",
    title: "SA Residents Midweek Escape",
    badge: "SA ID required",
    description: `A two-night midweek rate for South African residents — Sunday to Thursday, valid on production of a green
barcoded ID or smart card at check-in. All meals and drives included. Our way of keeping the lodge full in
the quiet middle of the week, and of making sure South Africans can actually afford the Lowveld.`,
    price_mode: "per_night",
    per_night_price: 3200,
    was_price: 4850,
    min_nights: 2,
    photo: 12,
    photoCap: "The lodge, midweek and quiet",
  },
];

// Real, licensed Commons files — curated by eye off a contact sheet, not by
// filename. Index = the slot referenced above.
const FILES = {
  0: "File:Djuma Vuyatela Lodge - South Africa Safari - Djuma Game Reserve - Sabi Sand - Kruger National Park (5585776655).jpg",
  1: "File:Djuma Vuyatela Lodge - South Africa Safari - Djuma Game Reserve - Sabi Sand - Kruger National Park (5586377636).jpg",
  2: "File:Djuma Vuyatela Lodge - South Africa Safari - Djuma Game Reserve - Sabi Sand - Kruger National Park (5586371482).jpg",
  5: "File:Deck outside room, Jaci's Safari Lodge (8566003167).jpg",
  6: "File:Simbavati4.jpg",
  9: "File:Jaci's Lodge, Madikwe Game Reserve, North West, South Africa (20533373235).jpg",
  10: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19909974054).jpg",
  11: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19909326964).jpg",
  12: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (20343545440).jpg",
  13: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19910591953).jpg",
  14: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19910207673).jpg",
  15: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19908055724).jpg",
  16: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19907825724).jpg",
  17: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19909701314).jpg",
  18: "File:Jaci's Lodeges, Madikwe Game Reserve, North West, South Africa (19909673354).jpg",
  19: "File:Jaci's Hide, Madikwe Game Reserve, North West, South Africa (20520295055).jpg",
  20: "File:Jaci's Tree Lodge, Madikwe Game Reserve, North West, South Africa (20526751221).jpg",
  21: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19895083124).jpg",
  23: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19898803023).jpg",
  24: "File:Jaci's Lodges, Madikwe Game Reserve, North West, South Africa (19896592564).jpg",
};

async function main() {
  // ─── 1. Host ───────────────────────────────────────────────────
  const { data: profile } = await db
    .from("user_profiles")
    .select("id, email, full_name")
    .ilike("email", EMAIL)
    .maybeSingle();
  if (!profile) throw new Error(`No user_profile for ${EMAIL}`);

  const { data: host } = await db
    .from("hosts")
    .select("id, display_name, handle")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!host) throw new Error(`${EMAIL} has no host row — create the host first.`);
  log("host:", host.display_name, `(${host.id})`);

  // ─── 2. Business — triggers require it BEFORE the property ─────
  let { data: business } = await db
    .from("businesses")
    .select("id, trading_name")
    .eq("host_id", host.id)
    .eq("is_default", true)
    .maybeSingle();
  if (!business) {
    const { data, error } = await db
      .from("businesses")
      .insert({
        host_id: host.id,
        legal_name: "Mana Safari Collection (Pty) Ltd",
        trading_name: "Mana Bush Lodge",
        is_default: true,
        city: "Hazyview",
        province: "Mpumalanga",
        country: "ZA",
        postal_code: "1242",
        address_line1: "Portion 14, Kiepersol Road",
      })
      .select("id, trading_name")
      .single();
    if (error) throw new Error("business: " + error.message);
    business = data;
    log("business: created", business.trading_name);
  } else {
    // Fill in the blanks on the existing default business without renaming it.
    await db
      .from("businesses")
      .update({
        legal_name: "Mana Safari Collection (Pty) Ltd",
        city: "Hazyview",
        province: "Mpumalanga",
        postal_code: "1242",
        address_line1: "Portion 14, Kiepersol Road",
      })
      .eq("id", business.id);
    log("business: reused", business.trading_name, `(${business.id})`);
  }

  // ─── 3. Policies ───────────────────────────────────────────────
  const { error: polErr } = await db.rpc("ensure_host_default_policies", {
    p_host_id: host.id,
  });
  if (polErr) log("! policies:", polErr.message);
  const { count: polCount } = await db
    .from("policies")
    .select("id", { count: "exact", head: true })
    .eq("host_id", host.id);
  log("policies:", polCount ?? 0);

  // ─── 4. Property ───────────────────────────────────────────────
  let { data: property } = await db
    .from("properties")
    .select("id, name")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!property) {
    const { data, error } = await db
      .from("properties")
      .insert({
        host_id: host.id,
        business_id: business.id,
        property_type: "accommodation",
        accommodation_type: "lodge",
        category_id: "3fd2dea2-e01c-42c9-9ab1-466b49ef9d43", // Lodge
        name: "Mana Bush Lodge",
        slug: SLUG,
        description: LISTING_DESCRIPTION,
        house_rules: HOUSE_RULES,
        what_to_bring: WHAT_TO_BRING,
        address_line1: "Portion 14, Kiepersol Road",
        city: "Hazyview",
        province: "Mpumalanga",
        country: "ZA",
        postal_code: "1242",
        latitude: -25.0361,
        longitude: 31.1265,
        bedrooms: 3,
        bathrooms: 4,
        max_guests: 8,
        check_in_time: "14:00",
        check_out_time: "10:00",
        min_nights: 2,
        base_price: 4850,
        weekend_price: 5400,
        cleaning_fee: 0,
        currency: "ZAR",
        cancellation_policy: "moderate",
        booking_mode: "rooms_only",
        instant_booking: true,
        accepts_paystack: true,
        accepts_eft: true,
        is_published: true,
        published_at: new Date().toISOString(),
        child_price: 1200,
        infant_price: 0,
        pet_fee: 0,
        allow_pets: false,
        allow_children: true,
        allow_infants: true,
        vat_rate: 15,
      })
      .select("id, name")
      .single();
    if (error) throw new Error("property: " + error.message);
    property = data;
    log("property: created", property.name);
  } else {
    log("property: exists", property.name, `(${property.id})`);
  }

  // ─── 4b. Optional reset — clean this property's demo data ──────
  // Delete order is dictated by the FK graph (all RESTRICT unless noted):
  //   reviews → bookings (cascades booking_rooms) → photos → rooms.
  // Specials cascade off rooms/property, so they clear with the rooms.
  if (RESET) {
    log("reset: wiping demo rooms/photos/bookings for a clean rebuild…");

    // Reviews first — reviews.booking_id is RESTRICT.
    await db.from("reviews").delete().eq("property_id", property.id);
    // Clear the featured-review pointer so nothing dangles.
    await db
      .from("properties")
      .update({ featured_review_id: null })
      .eq("id", property.id);

    // Bookings — cascades booking_rooms, which is the RESTRICT that blocks the
    // room delete below. On a full reset we clear EVERY booking on the demo
    // property (there is no production data pre-launch), not just BK-DEMO-*, so
    // an earlier hand-made booking can't keep a junk room alive.
    const { data: delBk, error: bkErr } = await db
      .from("bookings")
      .delete()
      .eq("property_id", property.id)
      .select("id");
    if (bkErr) log("   ! booking delete:", bkErr.message);
    log(`   - ${delBk?.length ?? 0} bookings`);

    // Specials (explicit, by our slugs — clean even if a room delete wouldn't
    // reach them).
    await db
      .from("specials")
      .delete()
      .eq("property_id", property.id)
      .in("slug", SPECIALS.map((s) => s.slug));

    // Photo storage objects, then rows.
    const { data: photoRows } = await db
      .from("property_photos")
      .select("storage_path")
      .eq("property_id", property.id);
    const paths = (photoRows ?? []).map((p) => p.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: rmErr } = await db.storage
        .from("listing-photos")
        .remove(paths);
      if (rmErr) log("   ! storage remove:", rmErr.message);
      else log(`   - ${paths.length} storage objects`);
    }
    await db.from("property_photos").delete().eq("property_id", property.id);

    // Rooms — booking_rooms is gone (cascaded), so nothing RESTRICTs now.
    await db
      .from("property_rooms")
      .update({ featured_photo_id: null })
      .eq("property_id", property.id);
    const { data: delRooms, error: roomErr } = await db
      .from("property_rooms")
      .delete()
      .eq("property_id", property.id)
      .select("id");
    if (roomErr) log("   ! room delete:", roomErr.message);
    log(`   - ${delRooms?.length ?? 0} rooms`);
  }

  // ─── 5. Listing gallery ────────────────────────────────────────
  log("listing photos…");
  let n = 0;
  for (let i = 0; i < LISTING_PHOTOS.length; i++) {
    const p = LISTING_PHOTOS[i];
    const r = await attachPhoto({
      propertyId: property.id,
      title: FILES[p.i],
      key: `listing-${i}`,
      sort: i,
      caption: p.cap,
    });
    if (r.ok) n++;
  }
  log(`   +${n} new`);

  // ─── 6. Rooms + their galleries ────────────────────────────────
  for (let ri = 0; ri < ROOMS.length; ri++) {
    const r = ROOMS[ri];
    let { data: room } = await db
      .from("property_rooms")
      .select("id, name")
      .eq("property_id", property.id)
      .eq("name", r.name)
      .maybeSingle();
    if (!room) {
      const { data, error } = await db
        .from("property_rooms")
        .insert({
          property_id: property.id,
          name: r.name,
          description: r.description,
          base_price: r.base_price,
          weekend_price: r.weekend_price,
          cleaning_fee: r.cleaning_fee,
          currency: "ZAR",
          max_guests: r.max_guests,
          bedrooms: r.bedrooms,
          bathrooms: r.bathrooms,
          bed_type: r.bed_type,
          view_type: r.view_type,
          room_size_sqm: r.room_size_sqm,
          has_ensuite_bathroom: r.has_ensuite_bathroom,
          private_entrance: r.private_entrance,
          sort_order: ri,
          is_active: true,
        })
        .select("id, name")
        .single();
      if (error) {
        log("! room:", r.name, error.message);
        continue;
      }
      room = data;
      log("room: created", room.name, `R${r.base_price}`);
    } else {
      log("room: exists", room.name);
    }

    let rn = 0;
    for (let i = 0; i < r.photos.length; i++) {
      const p = r.photos[i];
      const res = await attachPhoto({
        propertyId: property.id,
        roomId: room.id,
        title: FILES[p.i],
        key: `room-${r.key}-${i}`,
        sort: i,
        caption: p.cap,
      });
      if (res.ok) rn++;
    }
    log(`   +${rn} photos`);
  }

  // Re-read the rooms so bookings/specials can reference them by name.
  const { data: roomRows } = await db
    .from("property_rooms")
    .select("id, name, base_price")
    .eq("property_id", property.id);
  const roomByName = new Map((roomRows ?? []).map((r) => [r.name, r]));

  // A public photo URL for reuse as a special hero (specials have one hero slot).
  const { data: heroPhotos } = await db
    .from("property_photos")
    .select("url, sort_order, room_id")
    .eq("property_id", property.id)
    .is("room_id", null)
    .order("sort_order");
  const listingUrls = (heroPhotos ?? []).map((p) => p.url);

  // ─── 7. Bookings (real, varied statuses) + 8. Reviews ──────────
  await seedBookingsAndReviews(property, host, roomByName);

  // ─── 9. Specials ───────────────────────────────────────────────
  await seedSpecials(property, host, business, roomByName, listingUrls);

  log("\nDONE — property:", property.id);
}

// A date N days from now, as yyyy-mm-dd.
function day(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
function iso(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
}

const BOOKINGS = [
  // Past, completed — these carry the reviews.
  { ref: "BK-DEMO-01", room: "Leadwood Suite", guest: "Sarah van der Merwe",
    email: "sarah.vdm@example.com", in: -54, out: -51, guests: 2, status: "completed",
    review: { rating: 5, cleanliness: 5, communication: 5, checkin: 5, location: 5, value: 4,
      body: `We have done a lot of safaris and Mana is the one we keep talking about. Three nights in the Leadwood
Suite and we saw four of the Big Five from the vehicle plus a leopard with two cubs on the last morning.
Our guide Petrus could read the bush like a book. The suite itself is beautiful — waking up to the sunrise
over the riverbed without leaving the bed is something else. The food was ridiculous. We'll be back.` } },
  { ref: "BK-DEMO-02", room: "Marula Family Suite", guest: "The Okafor Family",
    email: "j.okafor@example.com", in: -33, out: -30, guests: 4, status: "completed",
    review: { rating: 5, cleanliness: 5, communication: 4, checkin: 5, location: 5, value: 5,
      body: `Travelled with two teenagers who put their phones down for the first time in years. The Marula suite
was perfect for us — the kids had their own room and bathroom and we could still hear the elephant at the
waterhole at night. The team went out of their way to make it special, including a surprise cake for our
daughter's birthday. Genuinely the trip of a lifetime and worth every rand.` } },
  { ref: "BK-DEMO-03", room: "Tamboti Star-Bed Suite", guest: "Mark Thompson",
    email: "mthompson@example.co.uk", in: -20, out: -18, guests: 2, status: "completed",
    review: { rating: 4, cleanliness: 5, communication: 5, checkin: 4, location: 5, value: 4,
      body: `Sleeping out on the star bed was the highlight of three weeks in South Africa — you are properly under
the stars with the sounds of the bush all around you, and the lions on the northern boundary at 3am is a
sound I won't forget. Only reason it's four and not five is the drive in from the gate is rough on a normal
car (take their transfer). Everything else was faultless. The bread out of the coals every morning, wow.` } },
  // Upcoming, confirmed.
  { ref: "BK-DEMO-04", room: "Leadwood Suite", guest: "Nomsa Dlamini",
    email: "nomsa.d@example.com", in: 21, out: 24, guests: 2, status: "confirmed" },
  // New request, pending.
  { ref: "BK-DEMO-05", room: "Marula Family Suite", guest: "The Bianchi Family",
    email: "bianchi@example.it", in: 40, out: 44, guests: 4, status: "pending" },
];

async function seedBookingsAndReviews(property, host, roomByName) {
  log("bookings…");
  for (const b of BOOKINGS) {
    const room = roomByName.get(b.room);
    if (!room) { log("   ! no room for booking", b.ref); continue; }

    let { data: booking } = await db
      .from("bookings")
      .select("id, status")
      .eq("reference", b.ref)
      .maybeSingle();

    if (!booking) {
      const nights = b.out - b.in;
      const base = Number(room.base_price) * nights;
      const done = b.status === "completed";
      const confirmedLike = done || b.status === "confirmed";
      const { data, error } = await db
        .from("bookings")
        .insert({
          property_id: property.id,
          host_id: host.id,
          reference: b.ref,
          status: b.status,
          scope: "rooms",
          origin: "guest_request",
          check_in: day(b.in),
          check_out: day(b.out),
          guests_count: b.guests,
          base_amount: base,
          cleaning_fee: 0,
          total_amount: base,
          currency: "ZAR",
          payment_method: "paystack",
          payment_status: confirmedLike ? "completed" : "pending",
          policy_acknowledged: true,
          policy_acknowledged_at: iso(b.in - 7),
          guest_name: b.guest,
          guest_email: b.email,
          confirmed_at: confirmedLike ? iso(b.in - 7) : null,
          checked_out_at: done ? iso(b.out) : null,
        })
        .select("id, status")
        .single();
      if (error) { log("   ! booking", b.ref, error.message); continue; }
      booking = data;
      // Link the room (booking_rooms).
      await db.from("booking_rooms").insert({
        booking_id: booking.id,
        room_id: room.id,
        base_amount: base,
        cleaning_fee: 0,
      });
      log(`   + ${b.ref} (${b.status})`);
    } else {
      log(`   = ${b.ref} exists`);
    }

    // Review for completed bookings — published so it shows on the listing.
    if (b.review) {
      const { data: existing } = await db
        .from("reviews")
        .select("id")
        .eq("booking_id", booking.id)
        .maybeSingle();
      if (!existing) {
        const rv = b.review;
        const { error } = await db.from("reviews").insert({
          booking_id: booking.id,
          property_id: property.id,
          host_id: host.id,
          guest_id: null, // author name falls back to booking.guest_name
          rating: rv.rating,
          rating_cleanliness: rv.cleanliness,
          rating_communication: rv.communication,
          rating_checkin: rv.checkin,
          rating_location: rv.location,
          rating_value: rv.value,
          body: rv.body,
          is_published: true,
          publish_at: iso(b.out + 1),
        });
        if (error) log("   ! review", b.ref, error.message);
        else log(`   + review ${rv.rating}★ on ${b.ref}`);
      }
    }
  }
}

async function seedSpecials(property, host, business, roomByName, listingUrls) {
  log("specials…");
  const heroFor = (idx) => listingUrls[idx % Math.max(1, listingUrls.length)] ?? null;
  for (let i = 0; i < SPECIALS.length; i++) {
    const s = SPECIALS[i];
    const { data: existing } = await db
      .from("specials")
      .select("id")
      .eq("slug", s.slug)
      .maybeSingle();
    if (existing) { log(`   = ${s.slug} exists`); continue; }

    const savings =
      s.was_price != null && (s.per_night_price ?? s.flat_total) != null
        ? Math.round(
            ((s.was_price - (s.per_night_price ?? s.flat_total)) / s.was_price) *
              100,
          )
        : null;

    const row = {
      host_id: host.id,
      business_id: business.id,
      property_id: property.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      badge: s.badge,
      // Flexible evergreen window so the special is always "live" for the demo.
      date_mode: "flexible",
      is_evergreen: true,
      window_start: day(0),
      min_nights: s.min_nights,
      price_mode: s.price_mode,
      per_night_price: s.per_night_price ?? null,
      flat_total: s.flat_total ?? null,
      was_price: s.was_price ?? null,
      savings_pct: savings,
      currency: "ZAR",
      quantity: 20,
      status: "active",
      show_in_directory: true,
      show_on_website: true,
      // Absolute URL passes straight through websiteAssetUrl(); the image is a
      // real safari photo already in the host's library.
      hero_image_path: heroFor(s.photo),
    };
    const { error } = await db.from("specials").insert(row);
    if (error) log("   ! special", s.slug, error.message);
    else log(`   + ${s.slug}`);
  }
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
