# Plan — Policy enforcement, add-ons & refunds (booking safety)

> **Goal (founder):** the policy/terms/house-rules/refund-schedule + check-in/out times that were
> **active when a booking was made** are frozen onto the booking, shown to the guest at checkout behind
> an explicit "I accept" for BOTH the host's legal policies AND Wielo's platform terms, visible on the
> booking instance afterwards, and **enforced on refund** — with the host unable to change them after the
> fact. Add-ons fully wired. Refund process tested on the UI from both ends.
>
> **Status of this doc:** grounded audit + implementation plan. Audited live against the cloud DB on
> 2026-07-12 (two Explore agents + direct RPC probes).
>
> **✅ Progress 2026-07-12 (session #62):** **Phase 0 (P0/G1) + Phase 1 (G2/G3/G4) are DONE and verified
> live.** Migrations `20260712140000` (snapshot fix + backfill) and `20260712150000` (immutability trigger
> + refund→payment_status). `persist.ts` snapshot write now alerts admins on failure (G2). Verified:
> the RPC succeeds + refund tiers compute (100/50/0%); `policy_snapshots` backfilled (28 rows) and a NEW
> real booking (BK-0037) froze all 4 policy types via the live guest checkout; immutability blocks
> service-role UPDATE/DELETE; a live host refund flipped `bookings.payment_status` (partial→
> `partially_refunded`, full→`refunded`). **Remaining: Phase 2 (G5 refund-off-amount-paid, G6 "Policies
> (as booked)" panel, G7 add-ons) + Phase 3 (G8/G9 legal) + the Paystack sandbox card-path proof.**

---

## 🔴 P0 — CRITICAL, blocks everything: policy snapshot is silently broken in production

**The single most important finding.** `snapshot_booking_policies` **crashes on every call** on the live
DB with `ERROR: function min(uuid) does not exist`, so **NO booking gets a policy snapshot at all**
(`policy_snapshots` is empty for every booking, incl. the real BK-0035). The booking-create call is
best-effort (`persist.ts:204`, unchecked `await`), so bookings still succeed — but with **no frozen
policy**. Downstream, `calculate_policy_refund_amount` returns `rule_applied='no_policy_snapshot'` →
**0% refund** for everyone. The checkout *shows* "Moderate cancellation (100/50/0%)" but nothing is
enforced. **Guest protection is currently absent.**

- **Root cause:** `supabase/migrations/20260619000000_specials_booking_policy_override.sql:59` —
  `SELECT count(*), min(room_id) INTO v_nroom, v_room`. Postgres has no `min(uuid)` aggregate. This
  regressed the fix from `20260610180006_fix_snapshot_min_uuid.sql` (which used count-then-select); the
  later specials migration re-introduced `min(room_id)` and, being the latest `CREATE OR REPLACE`, is
  what's deployed.
- **Fix:** new migration re-defining `snapshot_booking_policies` (the 3-arg specials-override version)
  with the count-then-conditional-select room derivation:
  ```sql
  SELECT count(*) INTO v_nroom FROM booking_rooms WHERE booking_id = p_booking_id;
  IF v_nroom = 1 THEN
    SELECT room_id INTO v_room FROM booking_rooms WHERE booking_id = p_booking_id LIMIT 1;
  ELSE
    v_room := NULL;
  END IF;
  ```
  Keep the 4 policy types (`cancellation`, `check_in_out`, `house_rules`, `booking_terms`) and the
  special-override precedence. Then **backfill** every booking missing a cancellation snapshot (the
  180006 heal-loop pattern). **Drop the buggy 2-arg overload** (or redefine it to delegate to the 3-arg
  with NULL) so `persist.ts`'s 2-arg call can never hit a stale body again.
- **Verify:** call the RPC on BK-0035 → `policy_snapshots` gets cancellation/check_in_out/house_rules
  rows; `calculate_policy_refund_amount(BK-0035, now)` returns the real % (not `no_policy_snapshot`).

---

## What already exists and is CORRECT (do not rebuild)

From the audit — these are sound; the plan builds on them:

- **Snapshot design.** `policy_snapshots` (INSERT-only table, `UNIQUE(booking_id, policy_type)`,
  `ON DELETE RESTRICT`) stores one JSON row per policy type per booking: cancellation rules + refund %,
  `is_non_refundable`, check-in/out times + method, house-rules/T&C body HTML, policy `version`/`name`
  (`20260502000000_create_policy_manager_domain.sql:89-110`). The refund engine reads the **snapshot**,
  never the live listing (`calculate_policy_refund_amount`, `20260502000004:24-27,57`) — so once P0 is
  fixed, later host policy edits genuinely do NOT change an existing booking. ✅ correct by design.
- **Wielo legal versioning.** Platform booking-terms + privacy are versioned in `platform_settings`;
  the version is stamped onto `bookings.accepted_terms_version` / `accepted_privacy_version` at checkout
  (`lib/legal.ts`, `createBooking.ts:784-787`). BK-0035 has `accepted_terms_version:3`,
  `accepted_privacy_version:2`, `policy_acknowledged:true`. ✅
- **Add-ons.** Server re-prices from the catalog (client prices ignored), snapshots `unit_price`/
  `subtotal`/`pricing_model`/`currency` onto `booking_addons` (so later host price changes don't affect
  the booking), folds checkout add-ons into `total_amount` + the booking invoice, and gives post-booking
  add-ons their own `kind='addon'` invoice + ledger rows (`createBooking.ts:401-511`, `persist.ts:158-198`,
  `payment-actions.ts:432-570`). ✅
- **Refund plumbing.** Host proactive refund, host approve/decline of a guest request, guest cancel (with
  refund preview), and guest refund-request-without-cancel **all exist** with UI
  (`lib/bookings/cancel.ts`, `dashboard/refunds/*`, `portal/trips/[id]/*`, `CancelTripButton.tsx`,
  `RequestRefundButton.tsx`). REF-#### numbers auto-mint; a refund does **not** auto-create a credit note
  (`20260607000004`). States: pending→approved→processing→completed (+declined/failed). ✅

---

## Confirmed gaps (the plan's work items)

| # | Severity | Gap | Evidence |
|---|---|---|---|
| **G1** | 🔴 P0 | `snapshot_booking_policies` crashes (`min(uuid)`) → no snapshots → 0% refunds | live RPC 42883; `20260619000000:59` |
| **G2** | 🟠 P1 | Snapshot write is best-effort/unchecked → silent failure leaves booking with no policy | `persist.ts:204` |
| **G3** | 🟠 P1 | No **DB-level immutability** on `policy_snapshots` — service-role client bypasses RLS, could UPDATE/DELETE | no `BEFORE UPDATE/DELETE` trigger exists |
| **G4** | 🟠 P1 | Booking `payment_status` never set to `refunded`/`partially_refunded` — only the `payments` row flips | trigger `20260502000005:56-78`; `ledger.ts:107-111` never sets it |
| **G5** | 🟡 P2 | Refund base = `total_amount`, **not amount actually paid**; `total_paid` mislabeled → wrong previewed/requested figure for partially-paid / deposit-only | `20260502000004:57,64`; `cancel.ts:135-151` |
| **G6** | 🟡 P2 | No **booking-instance UI** surfacing the snapshotted policy (cancellation schedule, check-in/out, house rules, T&C, accepted Wielo versions) on host + guest views | no reader of `policy_snapshots` in booking UI |
| **G7** | 🟡 P2 | Add-ons refunded only as flat `% × total`; no per-add-on / non-refundable add-on handling | `cancel.ts`, refund RPC |
| **G8** | 🔵 P3 | Platform T&C **text** not frozen (only version stamp) — reconstructing exact accepted copy depends on `platform_settings` history | `lib/legal.ts` |
| **G9** | 🔵 P3 | Checkout accept: verify BOTH host legal policy AND Wielo terms are distinctly shown + individually acknowledged (currently one combined checkbox) | checkout ack copy |

---

## The target workflow (record each step — Principle #12)

### At checkout (guest)
1. Guest sees, before paying: **cancellation policy + refund schedule**, **check-in/out times**, **house
   rules**, the **host's booking terms & conditions**, and **Wielo's platform terms + privacy** — each
   openable in full ("Read full policy"). → `ListingPolicyBlock`, checkout Policies section.
2. Guest ticks **one explicit acceptance** covering: host cancellation policy + host T&Cs + Wielo booking
   terms + privacy. (G9: confirm this is clear enough, or split host-vs-Wielo acknowledgements.)
3. On reserve → booking row records `policy_acknowledged=true`, `policy_acknowledged_at`,
   `accepted_terms_version`, `accepted_privacy_version`; **`snapshot_booking_policies` freezes the 4 host
   policy types into `policy_snapshots`** (G1 fix makes this actually happen; G2 makes failure loud).

### On the booking instance (after creation)
4. Host & guest both see a **"Policies (as booked)"** panel reading from `policy_snapshots` +
   the accepted Wielo versions — the immutable record (G6). Host edits to their live policy do NOT change
   this panel or the refund entitlement.

### On cancellation / refund
5. Actor cancels (host or guest) → `finalizeCancellation` → `calculate_policy_refund_amount` reads the
   **snapshot** rules, computes `days_before`, picks the refund % → creates a `refund_requests` row
   (REF-####) with `policy_snapshot_id` + `policy_entitlement`. Refund base corrected to amount-paid (G5).
6. Host approves → refund processed (capped to captured), `payments.refunded_amount`/status flip, **and
   `bookings.payment_status` → refunded/partially_refunded** (G4). Ledger shows the REF row
   (owed +1 / cash −1). No auto credit note.
7. Every transition logged (`refund_status_history`); guest + host notified.

---

## Implementation phases

**Phase 0 — P0 fix (do first, tiny, unblocks refunds)**
- Migration: fix `snapshot_booking_policies` room derivation; drop/redirect the buggy 2-arg overload;
  backfill all bookings. Regenerate types if signature changes. Verify via RPC + a real refund calc.

**Phase 1 — Safety hardening (P1)**
- G2: make the snapshot write checked — on failure, either unwind the booking or record + alert (never a
  silent no-policy booking). At minimum log to `admin_notifications`.
- G3: `BEFORE UPDATE OR DELETE ON policy_snapshots` trigger `RAISE EXCEPTION` unless `is_super_admin()`
  (mirror the INSERT-only intent already documented). Keep the GDPR purge path exempt.
- G4: on refund completion, call/extend `recomputeBookingPaymentState` (or a dedicated setter) to write
  `bookings.payment_status = refunded | partially_refunded`. Fix reviews-eligibility + board pills.

**Phase 2 — Correctness + visibility (P2)**
- G5: refund base = amount actually paid (read the ledger `sumCompletedPaid`); fix `total_paid` label;
  correct the guest/host preview for deposit-only/partial bookings.
- G6: **"Policies (as booked)" panel** on the booking detail (host `dashboard/bookings/[id]`) AND the
  guest trip (`portal/trips/[id]`) — render cancellation schedule, check-in/out, house rules, T&C, and
  "You accepted Wielo Terms v{n} + Privacy v{n} on {date}". Reads `policy_snapshots` + booking columns.
- G7: decide add-on refund policy — flag add-ons as refundable/non-refundable and either exclude
  non-refundable ones from the refund base or support per-line refunds.

**Phase 3 — Legal completeness + checkout clarity (P3)**
- G8: freeze the accepted platform T&C/privacy **HTML** (or snapshot into `policy_snapshots` as the
  `privacy`/platform-terms types) so the exact accepted copy is reproducible.
- G9: split the checkout acknowledgement so the host's legal policy and Wielo's platform terms are each
  clearly presented + accepted, and both recorded.

---

## Testing plan (UI, both ends) — the refund process end-to-end

Drive live on the preview + cloud DB (per the founder "seen working" rule):

1. **Snapshot present.** New booking on a VAT + policy'd listing → assert `policy_snapshots` has
   cancellation/check_in_out/house_rules rows matching what checkout showed.
2. **Immutability.** After booking, host edits the listing's cancellation policy → assert the booking's
   snapshot + refund entitlement are UNCHANGED; assert a direct UPDATE to `policy_snapshots` is rejected.
3. **Refund math from snapshot.** Cancel at different `days_before` (e.g. 6 days → 100%, 2 days → 50%,
   12h → 0% on Moderate) → assert `calculate_policy_refund_amount` matches the snapshot schedule, on
   amount-**paid** (test a deposit-only booking).
4. **Guest side.** Guest requests a refund / cancels from `portal/trips/[id]` → host sees the request in
   `dashboard/refunds` → host approves → REF-#### minted, ledger REF row, `bookings.payment_status`
   flips, guest notified. Screenshot both ends.
5. **Add-ons.** Booking with add-ons → cancel → confirm add-on handling matches the G7 decision.
6. **Booking-instance panel.** Confirm the "Policies (as booked)" panel renders on host + guest views
   with the frozen values.

---

## Card path proof (folded-in recommendation)

Before beta hosts take **card**, prove the Paystack path end-to-end (currently unexercised — the test
host has no gateway):

- **Set up a Paystack-connected test host.** Provide **Paystack test/sandbox** keys and connect them to a
  test host/business (own-gateway model — `host_paystack`). Sandbox card e.g. `4084 0840 8408 4081`,
  any future expiry, CVV `408`, OTP `123456`.
- Then drive: guest card checkout → deposit toggle on `/pay/[token]` → Paystack popup → return →
  `paystack-webhook` settles → confirmed + calendar + invoice + guest confirmation. Also a **partial
  card deposit → balance** to re-verify the reconciliation on the card rail.
- PayPal: same, once Wielo PayPal sandbox creds exist.

---

## Acceptance criteria (definition of done)
- [ ] `policy_snapshots` populated for every new booking (4 types) + backfilled for existing.
- [ ] Refund % computed from the snapshot, on amount-paid, verified at 3 `days_before` tiers, both actors.
- [ ] `policy_snapshots` UPDATE/DELETE rejected except super-admin.
- [ ] Snapshot write failure cannot produce a silent no-policy booking.
- [ ] `bookings.payment_status` reflects refunded/partially_refunded.
- [ ] "Policies (as booked)" panel visible on host + guest booking views.
- [ ] Add-on refund behaviour decided + implemented.
- [ ] Refund driven end-to-end on the UI from guest and host, screenshotted.
- [ ] Card path proven with a Paystack sandbox host.
- [ ] `pnpm build` + `pnpm lint` green; types regenerated; docs (`booking.md`, `payments-ledger.md`,
      new `reviews.md`/refund lifecycle) updated.

---

## Key files & symbols (for the implementer)
- Snapshot fn: `supabase/migrations/20260619000000_specials_booking_policy_override.sql` (buggy `:59`);
  fix reference `20260610180006_fix_snapshot_min_uuid.sql`. Table `20260502000000:89-110`.
- Refund calc: `20260502000004_create_v11_functions.sql:7-67` (`calculate_policy_refund_amount`).
- Snapshot call: `apps/web/lib/bookings/persist.ts:204`. Acceptance: `createBooking.ts:784-787`, `lib/legal.ts`.
- Cancel/refund core: `apps/web/lib/bookings/cancel.ts`; host UI `app/[locale]/dashboard/refunds/*` +
  `bookings/[id]/IssueRefundButton.tsx`; guest UI `app/[locale]/portal/trips/[id]/*`.
- Add-ons: `createBooking.ts:401-511`, `persist.ts:158-198`, `payment-actions.ts:432-570`,
  `lib/payments/invoicing.ts`. Ledger normalization: `lib/finance/transactions.ts`.
- payment_status refund gap: trigger `20260502000005:56-78`; `lib/payments/ledger.ts:86-115`.
