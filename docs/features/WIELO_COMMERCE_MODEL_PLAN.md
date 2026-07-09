# Wielo Commerce Model — product types, multi-subscription, guest-first, auto-ledger

**Status:** PLANNED (2026-07-09). Founder vision: run the whole business off one
system — create + combine memberships, services and once-off products; every buyer
is captured as a user; every money movement lands on the live ledger with the right
document, automatically.

This supersedes the piecemeal product handling. Build it in the phases below.

---

## 0. Already shipped (context)
- Admin ledger (revenue) with product filter over ALL products (incl. one-off),
  running balance, docs, KPIs, Test/Live toggle. `product_type` NOT yet modelled —
  today `products.type` is `subscription | one_off`.
- Product pay page: per-method buttons (card/PayPal/EFT) strictly from the product's
  `payment_methods`; **EFT is now a "Pay with EFT" button** that records a PENDING
  ledger charge (assigning/creating a guest user first) then reveals bank details.
- Paystack/PayPal settle → order paid, ledger completed, invoice minted, plan
  activated (subscription products), affiliate accrued.
- Admin can edit subscriptions/products freely (grant block removed there).

## 1. Product types (foundation — do FIRST)
Replace `products.type` (`subscription | one_off`) with **`product_type`**:
- **`membership`** — the Wielo subscription. A user may have **ONE active membership**.
- **`service`** — a subscription service. A user may have **MANY** active.
- **`product`** — a once-off purchase. A user may buy **MANY**.

Work:
- Migration: add `product_type` (enum/text + check), backfill from `type`
  (subscription→membership OR service? — see decision), keep `type` briefly or drop
  (pre-MVP: drop + reshape). Regenerate types.
- Product editor: a Type selector (membership / service / product). Membership +
  service keep the subscription fields (billing cycle, plan_key/feature tier); product
  is once-off (price only). Reuse the existing payment-methods + affiliate blocks.
- Everywhere that branches on `type === "subscription"|"one_off"` updates to the new
  enum: `getSubscriptionProducts` (membership+service), `getSellableProducts`,
  pay/settle flows (`activateMappedPlan`), overview "Products" (group by the 3 types),
  ledger filter grouping.
- **Decision:** membership vs service both grant feature tiers? Confirm which
  `plan_key` drives gating when a user has a membership + several services.

## 2. Multi-subscription per user
Today `subscriptions` is one row per host. Support many:
- A user (host) can have: 1 membership sub + N service subs + N product purchases.
- Schema: allow multiple `subscriptions` rows per host, each linked to a
  `product_id` (its type in `products.product_type`). Enforce the ONE-membership rule
  (partial unique index on host_id where product is a membership + active, or a guard
  in the activation path).
- Feature gating: resolve the union of features from the active membership + active
  services (check_feature_permission reads product_features across active subs).
- Admin user record "Products" tab: list ALL the user's subscriptions (membership +
  services) + product purchases; add/upgrade/downgrade/cancel each.

## 3. Every transaction has a user (guest-first)
Rule: **no ledger/order transaction without a user.** By default every buyer is a
**guest** user.
- Checkout: the moment an email is entered → treat as checkout initiated → create the
  guest account (findOrCreateLeadIdentity) so we keep the contact even if they never
  pay. (EFT button already does this on click; extend to the card/PayPal init + the
  email step.)
- Logged-in buyer: skip asking for personal details; assign to their account.
- Collect **full details: name, email, phone** at checkout (guest) — store on the
  user profile / order.
- Backfill/guard: `createProductOrder` + all settle paths ensure `payer_user_id`
  (create guest from email if missing); platform_ledger.user_id is never null for a
  product/subscription charge. Audit + fix any existing orphan rows.

## 4. Admin changes auto-record on the ledger (with the right document)
When an admin adjusts a user's subscription/product, run the money automations —
never a silent state flip:
- **Upgrade / add** (membership↔higher, add a service/product) → a **charge** +
  **invoice** (or a pay-link if not prepaid), pro-rated where relevant.
- **Downgrade / cancel a paid sub** → a **credit note** / **refund** for the unused
  portion (or a scheduled change) — recorded on the live ledger.
- Manual/immediate: reuse `recordManualLedgerEntryAction` + the mint triggers so the
  doc (INV/CN/REF) is generated automatically and appears in the ledger + the user's
  transaction history.
- Wire this into `adminUpdateSubscription` / `setUserProduct`: detect the delta
  (old product/price → new) and post the corresponding ledger entry + document.
- **DECISION (founder 2026-07-09):** on downgrade, DEFAULT to a **credit note**,
  but let the admin CHOOSE **refund or credit note** at the moment they enforce the
  downgrade (a small choice in the downgrade/manage-subscription confirm). Record
  the chosen document on the live ledger.
- **DECISION (founder 2026-07-09):** the admin also chooses the **timing** of any
  change — **enforce immediately** OR **at the end of the current cycle**
  (schedule the change to apply at `current_period_end`). So the manage-subscription
  confirm has: document (credit note / refund) + timing (now / end of cycle). An
  end-of-cycle change is stored as a pending scheduled change and applied by the
  billing worker/cron at period end (then it posts the ledger entry + doc).
- **DECISION (founder 2026-07-09):** the HOST (self-serve) may **UPGRADE** their
  subscription but **NOT downgrade**. Downgrades + cancellations are **admin-only**
  (they trigger the credit-note/refund + timing decision above). "Upgrade" = switch
  the membership to a higher-priced one, or ADD a service/product; "downgrade" =
  switch to a cheaper membership, or cancel. So the host subscription page offers
  upgrade paths + add-service/product only; a cheaper option / cancel is disabled
  with a "contact support" affordance (routes to the Wielo inbox thread).
- **Open decision:** pro-ration policy on an IMMEDIATE change (full amount vs
  pro-rated unused portion).

## 5. Guest transaction history in settings
- Guests + hosts can see their Wielo purchases: `product_orders` + `wielo_invoices`
  (+ credit notes/refunds) with downloadable docs, in `/portal/settings` (guest) and
  `/dashboard/settings` (host). Ties to the purchase-confirmation email/inbox card
  (see PRODUCT_PURCHASE_LIFECYCLE_PLAN.md).
- No account yet → the confirmation email CTA routes to signup; after registering the
  history + inbox thread are populated (guest-first means the account already exists
  as a lead, so "register" = claim the passwordless account).

## 6. Build order
1. **Phase 1 — product types** (§1): migration + editor + branch updates. Foundational.
2. **Phase 2 — guest-first + transaction-user** (§3): create/assign user on email +
   every settle path; full name/phone/email at checkout; fix orphans.
3. **Phase 3 — multi-subscription** (§2): schema + one-membership guard + gating union
   + admin "Products" tab lists all subs/purchases.
4. **Phase 4 — auto-ledger on admin change** (§4): delta → charge/credit/refund + doc.
5. **Phase 5 — guest transaction history** (§5) + tie to the purchase-lifecycle
   notifications.

Each phase: tsc + lint + `pnpm build` green; verify live (admin + a real/guest
buyer); commit + push. Confirm the marked DECISIONS with the founder before building
that phase.

See: PRODUCT_PURCHASE_LIFECYCLE_PLAN.md (inbox card + email + failed-regenerate),
AFFILIATE_HARDENING_PLAN.md (affiliate, LAST). Memory:
[[project-product-purchase-lifecycle]], [[project-ledger-payments-affiliate-plan]].
