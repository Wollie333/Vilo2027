# Lifecycle — Policy enforcement & refunds

> The policy/terms/house-rules/refund-schedule + check-in/out times that were
> **active when a booking was made** are frozen onto the booking, shown to the
> guest at checkout behind an explicit accept, visible on the booking instance
> afterwards, **enforced on refund**, and the host cannot change them after the
> fact. Refund state is visible to BOTH host and guest.
>
> **Status:** 🟢 P0 fix + Phase 1 hardening + the "Policies (as booked)" panel
> driven live 2026-07-12 (CHANGELOG #62/#63). Remaining plan items (G5 refund
> off amount-paid, G7 add-on refundability, G8/G9 legal text, Paystack sandbox)
> are in `docs/features/POLICY_ENFORCEMENT_ADDONS_REFUNDS_PLAN.md`.

Key files: `supabase/migrations/20260712140000` (snapshot fix + backfill) ·
`20260712150000` (immutability + payment_status) · `snapshot_booking_policies()` ·
`calculate_policy_refund_amount()` (`20260502000004`) · `lib/bookings/persist.ts` ·
`lib/bookings/cancel.ts` · `app/[locale]/dashboard/refunds/actions.ts` ·
`lib/bookings/policiesAsBooked.ts` + `components/bookings/PoliciesAsBooked.tsx`.

---

## Step 1 — Checkout shows the policies and the guest accepts
- Trigger: guest reaches the checkout Policies section · Actor: guest
- Functions/files: `site/book/SiteCheckoutForm.tsx` / `property|deal/[…]/book/*`
  render cancellation schedule + check-in/out + house rules + host T&Cs + Wielo
  platform terms/privacy; one explicit "I accept" checkbox.
- Logic: reserve is blocked until accepted.
- DB writes: on reserve, `bookings.policy_acknowledged=true`,
  `policy_acknowledged_at`, `accepted_terms_version`, `accepted_privacy_version`
  (Wielo versions from `lib/legal.ts` / `platform_settings`).
- Side-effects: status(→ pending / pending_eft).
- Next: → Step 2.

## Step 2 — The effective policies are FROZEN onto the booking
- Trigger: booking row created · Actor: system
- Functions/files: `lib/bookings/persist.ts` →
  `admin.rpc("snapshot_booking_policies", { p_booking_id, p_listing_id, [special override] })`.
- Logic: resolve each of the 4 host policy types (cancellation → special override
  → room → listing → host default; then check_in_out / house_rules / booking_terms
  via `resolve_listing_policy_id`), and write one immutable JSON row per type.
  Room derivation counts `booking_rooms` first, then SELECTs the lone room (never
  `min(uuid)` — the P0 crash fixed in `20260712140000`).
- DB writes: `policy_snapshots` (INSERT-only; `UNIQUE(booking_id, policy_type)`) —
  cancellation stores the refund-% rules; others store times/flags + body text.
- Side-effects: **(G2)** if the RPC errors, `persist.ts` records a
  `policy_snapshot_failed` admin notification (`notifyAdmins`) instead of a silent
  no-policy booking; the booking is NOT unwound (the guest completed checkout).
- Next: → Step 3.

## Step 3 — The frozen policy is immutable
- Trigger: any UPDATE/DELETE on `policy_snapshots` · Actor: system / service-role
- Functions/files: trigger `forbid_policy_snapshot_mutation()` (`20260712150000`).
- Logic: **(G3)** UPDATE always raises; DELETE raises unless the GDPR purge set the
  txn-local flag `app.allow_policy_snapshot_purge='on'` (`app_purge_user_account`).
- DB writes: none (rejects). SQLSTATE 23001 on violation.
- Side-effects: later host edits to their live policy do NOT change this booking's
  frozen record or its refund entitlement.
- Next: → Step 4.

## Step 4 — "Policies (as booked)" is shown on the booking instance
- Trigger: host opens `dashboard/bookings/[id]` or guest opens `portal/trips/[id]`
  · Actor: host | guest
- Functions/files: `lib/bookings/policiesAsBooked.ts` (`loadPoliciesAsBooked`,
  reads `policy_snapshots` — never the live listing) → shared pure component
  `components/bookings/PoliciesAsBooked.tsx`.
- Logic: **(G6)** render the frozen cancellation schedule, check-in/out, house
  rules, T&C, plus "You/The guest accepted these policies, plus Wielo Terms v{n}
  and Privacy v{n} on {date} — the host cannot change them after booking." On the
  guest trip page the live "Know before you go" block is now a fallback only.
- DB writes: none (read-only). RLS: `guest_read_own_snapshots` /
  `host_read_booking_snapshots`.
- Side-effects: both parties see the SAME immutable record.
- Next: → Step 5 (on cancellation).

## Step 5 — Cancellation computes the refund from the snapshot
- Trigger: host or guest cancels · Actor: host | guest
- Functions/files: `lib/bookings/cancel.ts` → `finalizeCancellation` →
  `policyRefundFor` → `calculate_policy_refund_amount(booking, now)`.
- Logic: reads the CANCELLATION snapshot (never the live policy); computes
  `days_before = check_in - now`, picks the matching refund %, returns
  `{refund_amount, refund_percent, rule_applied, days_before_checkin, total_paid}`.
  Non-refundable → 0%. No snapshot → `no_policy_snapshot` (the P0 symptom, now
  impossible for new bookings). ⚠️ **G5 pending:** base is still `total_amount`,
  not amount actually paid — wrong for deposit-only/partial.
- DB writes: `bookings.status → cancelled_by_host|guest`; if refund due + a
  captured payment + no open refund → `refund_requests` (pending, REF-####,
  `policy_entitlement`, `is_auto_refund`).
- Side-effects: `on_booking_cancelled` releases `blocked_dates` + rolls counters ·
  notification(`booking_cancelled_host|guest`).
- Next: → Step 6.

## Step 6 — Host approves → refund completes → money state reflects it
- Trigger: host approves in `dashboard/refunds` (or host-initiated refund) · Actor: host
- Functions/files: `dashboard/refunds/actions.ts` (`approveRefundAction` /
  `hostInitiatedRefundAction`) → `refund_requests.status → approved → completed`
  (capped to captured − prior refunds).
- Logic: completion fires the v11 trigger `update_payment_refunded_amount`
  (`20260502000005`, extended in `20260712150000`): bumps
  `payments.refunded_amount`, flips `payments.status` (refunded / partially_refunded),
  and **(G4)** rolls `bookings.payment_status` up from all payments →
  `refunded` / `partially_refunded`.
- DB writes: `refund_requests`, `payments`, `bookings.payment_status`,
  `refund_status_history` (audit). No auto credit-note.
- Side-effects: REF-#### minted · ledger REF row (owed +1 / cash −1) · guest + host
  notified. ⚠️ known ledger quirk: a partially-refunded payment stops counting in
  `sumCompletedPaid` (status ≠ 'completed') so the Payments panel shows PAID R0 —
  logged to NEXT_STEPS §1 financial sweep.
- Next: → Step 7.

## Step 7 — The guest sees the refund state (parity)
- Trigger: guest opens their trip / trips list · Actor: guest
- Functions/files: `portal/trips/[id]/page.tsx` + `portal/trips/TripsClient.tsx`
  (derived `payState`).
- Logic: the Total glance + receipt show **Refunded / Partially refunded** and a
  "Refunded to you − R{n}" line; the trips-list card shows a payment chip. The
  `owesMoney` guard excludes refunded states so a refunded guest is never asked to
  pay (despite the balance-due ledger quirk).
- DB writes: none (read-only).
- Side-effects: host and guest see the same refund outcome from their own view.
- Next: — (loop closed).

---

## Verified (2026-07-12)
- `policy_snapshots` backfilled 0 → 28; a NEW live-checkout booking (BK-0037) froze
  all 4 types; refund calc returns 100/50/0% by tier. Service-role UPDATE + DELETE
  on `policy_snapshots` rejected (23001). Live host refund on BK-0027 (R2 000
  partial → `partially_refunded`) and a full refund on BK-0036 (→ `refunded`);
  guest sees "Partially refunded" + "Refunded to you − R 2 000".

## ⚠️ Not yet done (plan items)
- G5 refund off amount-**paid** · G7 add-on refundability (refundable/non-refundable,
  per-line) · G8/G9 freeze platform-T&C **text** + split host-vs-Wielo acceptance ·
  Paystack sandbox host to prove the card refund rail end-to-end.
