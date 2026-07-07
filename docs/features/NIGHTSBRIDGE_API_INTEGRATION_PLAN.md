# NightsBridge (deep) API integration — plan

Founder ask: go beyond iCal for the SA channels (SafariNow, LekkeSlaap, plus
Booking.com/Airbnb) by integrating **NightsBridge** — the African-built channel
manager that already aggregates 250+ channels including LekkeSlaap and local travel
agents — via its **API** rather than just its iCal export.

> **Status: PLANNED, not started.** This is a scoping doc. The first real blocker is
> commercial (a NightsBridge partner agreement + API credentials), not code — see
> §0. Nothing here should ship before that's in hand.

## Why this is a different animal from what we shipped

What we already have (2026-07-07): **iCal** import + export + hands-off cron. That
covers *availability only* — it pulls "these dates are blocked" every ~3h and pushes
our blocked dates out. It is enough to **prevent double bookings**, which is the goal
for most hosts, and it needs **zero** per-channel code (SafariNow/NightsBridge/etc.
are just presets now).

What iCal does **not** do, and only an API can:

| Capability | iCal (have) | NightsBridge API (this plan) |
|---|---|---|
| Block dates both ways | ✅ (poll ~3h) | ✅ near-real-time |
| Reason/room-level detail | partial | ✅ per room type |
| **Rates** push/pull (ARI) | ❌ | ✅ |
| **Inventory/allocation** | ❌ | ✅ |
| **Reservation delivery** (guest + payment detail into Wielo) | ❌ | ✅ |
| Latency | hours | seconds–minutes |

## 0. Commercial prerequisite (gate — do this first)

NightsBridge API access is partner-gated. Before any build:
- Engage NightsBridge re: connectivity partner / API access for Wielo.
- Obtain: API base URL, auth scheme + credentials, the **partner API docs**, sandbox
  access, and their certification requirements.
- Clarify the model: are we a **PMS/booking source** connecting *to* NightsBridge, or
  are we pulling a host's NightsBridge data *out*? These are different contracts.
- Confirm what a host must do on their side (authorise Wielo, map property/rooms).

Everything below assumes those are secured. Public signal that an availability/price
API exists (third-party "NightsBridge Availability and Price API" tutorials) — but the
authoritative surface is the partner docs, which we do **not** have yet. Treat all API
specifics below as **to-confirm against real docs**.

## 1. Strategic scope check (decide before building)

Wielo's positioning is **direct booking, 0% marketplace fee** (BUSINESS_PRINCIPLES).
Two very different things live under "channel integration":

- **(A) Availability/calendar sync** — keep Wielo's calendar in step with the host's
  other channels so nobody double-books. **Aligned** with Wielo. iCal already does the
  minimum; the API does it better + adds rates.
- **(B) Distribution** — push Wielo inventory *onto* LekkeSlaap/SafariNow to win
  bookings *there* (and pay their commission). This **contradicts** the direct-booking
  pitch and is a much larger, commission-bearing commitment.

**Recommendation: scope this plan to (A) only** unless the founder explicitly wants
(B). The API work below is framed as a superior two-way *sync*, not distribution.

## 2. Proposed architecture

Mirror the existing worker pattern (Next route + pg_cron) so it's consistent with the
iCal + email workers.

- **`channel_connections` table** (new) — one row per host-authorised NightsBridge
  link: `id, property_id, provider ('nightsbridge'), external_property_id,
  credentials_cipher (encrypted, PAYMENT_CIPHER_KEY-style), status, last_sync_at,
  last_error, direction ('import' | 'two_way')`. Do **not** reuse `ical_feeds` — the
  auth + mapping shape is different. Reference [[BOOKING_SYNC.md]].
- **Room mapping** — NightsBridge is per **room type**; Wielo is property + optional
  rooms. Need a `channel_room_map (connection_id, external_room_id, property_room_id)`.
- **Import worker** `/api/nightsbridge-sync-worker` (bearer-gated, like
  `ical-sync-worker`): pulls availability (+ rates if in scope) per connection, writes
  `blocked_dates` via the **same non-destructive `import_ical_blocks`-style RPC**
  (extend it or add `import_channel_blocks` with `source='channel'`), and — if rates in
  scope — upserts `property_seasonal_pricing`/room rates behind a clear "managed by
  NightsBridge" flag so hosts aren't surprised.
- **Reservation delivery** (if in scope) — inbound webhook or poll → create a Wielo
  booking with `source='nightsbridge'`, dedup on external reservation id (mirror the
  Paystack webhook idempotency pattern).
- **Outbound (two-way)** — on Wielo booking/block change, push availability back to
  NightsBridge. Guard against **echo loops** (don't re-import what we just pushed) via
  a source tag + a short quiet window.
- **pg_cron** `sync-nightsbridge` every 15 min, same inert-until-configured pattern
  (`app.nightsbridge_worker_url` / `_secret`).
- **Secrets** — `NIGHTSBRIDGE_API_*` in Vercel; host credentials encrypted at rest.

## 3. Slices (each ends green + committed)

1. **Contract + spike** (no prod code) — get partner docs/sandbox; write a throwaway
   script that authenticates and reads one property's availability. Confirms the real
   API shape. **Gate for everything after.**
2. **Schema** — `channel_connections` + `channel_room_map` + `import_channel_blocks`
   RPC (non-destructive, `source='channel'`). Migration + generated types.
3. **Connect UI** — host adds a NightsBridge connection (credentials + property pick +
   room mapping) on the calendar-sync page; encrypt + store.
4. **Import worker + cron** — one-way availability import, live-verified against
   sandbox, non-destructive (manual/booking blocks always win — the guarantee we
   already prove for iCal).
5. **Rates import** (optional, if in scope) — behind a "managed externally" flag.
6. **Two-way push** (optional) — outbound availability with echo-loop guard.
7. **Reservation delivery** (optional, biggest) — inbound bookings → Wielo, idempotent.

Ship 1–4 as the meaningful milestone (two-way-ready superior sync); 5–7 are additive.

## 4. Risks / unknowns

- **Auth + certification** — unknown until partner docs; may require a formal review.
- **Room-type mapping** mismatches (host has 3 NB room types, 1 Wielo property) — the
  map table + a clear UI handle this, but it's the fiddly part.
- **Double-booking safety** — reuse the proven non-destructive import (real Wielo
  blocks always win). Keep the DB-guard test discipline from the iCal work.
- **Rate ownership** — if we import rates, be explicit about who's the source of truth,
  or we'll clobber host pricing. Default: import OFF, availability only.
- **Rate limits / quotas** on the NB API — batch + back off; the 15-min cadence helps.

## 5. Recommendation

1. iCal presets (shipped) cover the majority need today — hosts on
   SafariNow/LekkeSlaap/NightsBridge can prevent double-bookings **now**.
2. Pursue the **NightsBridge partner conversation** (§0) in parallel. The moment we
   have sandbox creds, do Slice 1 to validate the real API, then build 2–4.
3. Keep it **sync, not distribution** (§1) to stay true to the 0%-fee positioning.
