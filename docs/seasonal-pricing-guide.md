# How seasonal pricing works

*Audience: hosts · Reading time: ~8 min · Category: Listings & pricing*

Vilo prices every booking the same way, every time, in a fixed order. Once you
know the order, you can predict every cent a guest will pay — and so can they.
There are no hidden multipliers and no success fee.

This guide explains the **Vilo Pricing Stack**, how **seasonal rules** work
(including the difference between a *set price* and a *percentage*), how Vilo
decides which rule wins when two overlap, and walks through four real examples
with Rand figures.

---

## The Vilo Pricing Stack

Every booking is priced in **5 fixed stages, in this order**. Each stage takes
the result of the one before it.

### 1. Nightly rate

For **each night** of the stay, Vilo picks exactly **one** rate, in this order:

1. **A Seasonal rule** — if an active seasonal rule covers that night, it wins.
2. **Your Weekend rate** — if no season covers the night and it's a weekend
   night, the weekend rate applies.
3. **Your Base rate** — otherwise, the standard nightly rate.

> **Weekend = Friday + Saturday nights** — the two high-demand leisure nights.
> (A "Friday night" is the night you check in on a Friday.)

### 2. Occupancy

Your per-guest / extra-guest settings adjust that nightly rate. If a room is
priced per person, or charges for guests above a threshold, that adjustment is
applied to whichever nightly rate won in stage 1.

### 3. Stay discounts

Applied to the **nights subtotal only**, in this order:

1. **Whole-place combo discount** — when a guest books your entire place.
2. **Length-of-stay discount** — **weekly** for stays of **7+ nights**,
   **monthly** for stays of **28+ nights**. *Monthly supersedes weekly* — a long
   stay gets the monthly rate, not both.

These are **% off the nights subtotal**. They never touch fees or extras.

### 4. Fees & extras

- **Cleaning fee** — charged **once** per booking.
- **Add-ons** — priced per their own model (per stay, per night, per guest, etc.).

**Fees and add-ons are NEVER discounted.** A length-of-stay discount lowers the
nights, never the cleaning fee or an add-on.

### 5. Total

The sum of everything above. **Vilo charges no success fee and no commission** —
the total the guest sees is the total you keep, minus only the payment
provider's processing fee.

---

## What a seasonal rule is

A seasonal rule has five parts (plus one optional one):

| Part | Meaning |
|------|---------|
| **When** | A date range, **inclusive** of both the start and end date. A **1-day range** (start = end) is a **single-date override** — perfect for one special night like New Year's Eve. |
| **What** | Either a **set price** or a **percentage** change (see below). |
| **Where** | The **whole place**, or **one specific room**. |
| **Priority** | A number. Higher priority wins when rules overlap. |
| **Minimum nights** *(optional)* | A minimum-stay just for that season — e.g. require 3 nights over a festive peak. |

### "What" has two types

**Set price (absolute)** — the exact nightly price for those dates.

- Your **extra-guest fee still applies on top** of the set price.
- Best for a **whole-listing** rule or a **single room**.
- ⚠️ On a **per-person room**, a set price is a *flat room nightly* — it will
  **not scale by guest count**. If you want a per-person room to keep scaling
  during a season, use a **percentage** instead.

**Percentage** — a `+` or `-` % change (e.g. `+40%` for the festive season,
`-20%` for winter).

- It scales **base + per-guest + extra-guest together**, so it stays correct
  across multi-room listings and per-person rooms.
- A percentage **replaces the weekend rate** on the nights it covers — it scales
  your **base** rate, not the weekend rate.

> **Rule of thumb:** reach for a **percentage** when you want the season to
> respect occupancy and per-person scaling (most multi-room or per-person
> listings). Reach for a **set price** when you want one exact nightly number for
> a whole place or a single room.

---

## The 3 golden rules for overlaps

When two seasonal rules could apply to the same night, Vilo decides
deterministically:

1. **More specific wins** — a **room** rule beats a **whole-place** rule, *for
   that room*.
2. **Higher priority wins** — stack a short holiday (priority `10`) on top of a
   long season (priority `1`), and the holiday wins on its dates.
3. **Newest wins ties** — if two rules are equally specific and equal priority,
   the most recently created one wins.

And the most important rule of all:

> **Seasonal rules do NOT stack.** Exactly **one** rule wins per night. A
> seasonal rule **replaces** the weekend rate on the nights it covers — it is
> never multiplied with another season or with the weekend rate.

This is by design: layering is expressed through **priority**, not by stacking
multipliers. It keeps the price predictable.

---

## Guardrails

Vilo protects you (and your guests) from impossible prices:

- A **set price must be greater than 0**.
- A **percentage is clamped** so a night can never drop below R0 — you cannot go
  below `-100%`.
- The **currency must match the listing's currency**.

---

## Four worked examples

All figures below come straight from Vilo's passing test suite, so they're exact.

### 1. Festive +50%, whole 3-room guesthouse

You run a guesthouse with three rooms. You add **one whole-place percentage rule
of +50%** covering the festive dates.

| Room | Base rate | During the festive rule |
|------|-----------|-------------------------|
| Standard room | R1 200 / night | **R1 800 / night** |
| Family room | R2 000 / night | **R3 000 / night** |

Because it's a **percentage**, each room scales off **its own** base rate. Your
discounts, cleaning fee, and add-ons are **unchanged** — the rule only touched
the nightly rates.

### 2. Single-night New Year's Eve override

You already have a **December season** of **R1 500 / night** at **priority 1**.
On top of it, you add a **1-day set-price rule of R3 000** for **Dec 31**, at
**priority 10**.

- **Dec 31** → **R3 000** (the higher-priority, single-date override wins).
- **Every other December night** → **R1 500** (the longer season still applies).

A 1-day range is the clean way to price a single special night without breaking
the season around it.

### 3. Winter -20% percentage

To fill the slow season, you add a **whole-place percentage rule of -20%**
across winter.

- A room with a **R1 000** base → **R800 / night** for the whole season.
- **Per-guest scaling is preserved** — because it's a percentage, the discount
  applies to base + per-guest together, so an occupancy-priced room still scales
  correctly, just 20% lower.

### 4. Weekend vs season

A guest books **Thursday → Sunday** (3 nights: Thu, Fri, Sat). Your **base** is
**R1 000** and your **weekend** rate is **R1 500**. There is **no season**.

| Night | Rate | Why |
|-------|------|-----|
| Thursday | **R1 000** | Base — not a weekend night |
| Friday | **R1 500** | Weekend night |
| Saturday | **R1 500** | Weekend night |

Now add a **festive season** covering those same nights. The **season replaces
the weekend rate** — every covered night uses the season's rate, and the weekend
uplift no longer applies on top.

---

## Common mistakes

- **Using a *set price* on a per-person room and expecting it to scale.** A set
  price is a flat room nightly — it won't multiply by guest count. Use a
  **percentage** on per-person rooms.
- **Expecting cleaning or add-ons to be discounted.** Stage 3 discounts only
  touch the **nights subtotal**. The cleaning fee and add-ons are never reduced.
- **Two overlapping rules with the *same* priority.** When rules tie, "newest
  wins" — which may not be what you intended. Give the rule you want to win a
  **higher priority** so the outcome is obvious.
- **Forgetting seasons replace the weekend rate.** A season doesn't stack on top
  of your weekend uplift — it *replaces* it on the nights it covers.

---

## In one sentence

Vilo picks **one** nightly rate per night (season → weekend → base), adjusts it
for occupancy, applies your stay discounts to the nights subtotal, adds cleaning
and add-ons (never discounted), and shows the guest a labelled, per-night
breakdown so the price you preview is exactly the price they pay.
