# Product Purchase Lifecycle — build plan

**Status:** PLANNED (2026-07-09). Founder decisions already taken (below). This is the
NEXT build after the visible-fix slices shipped this session, and BEFORE the affiliate
hardening (`AFFILIATE_HARDENING_PLAN.md`, which is last).

Founder's flow (verbatim intent): admin creates a product → user buys → pays with
Paystack / PayPal / EFT (whichever the product accepts) → user can create their account
→ **simultaneously**: a card is posted to that user's inbox thread + an email is sent, the
transaction is recorded in the ledger under that user, and every status (success / failed /
refunded) is tracked. All Wielo transactional + account info is shared via the inbox. Failed
payments → admin can regenerate + resend the pay link. "Simple system: admin creates
products and sells them; Wielo makes it easy to track transactions + communications."

---

## 0. Already shipped (context — do NOT rebuild)
- Ledger records a `platform_ledger` charge on settlement for Paystack / PayPal / EFT /
  manual; invoice minted by trigger; balance + running balance work (verified).
- Product pay page (`/pay/product/[token]`) renders a button per accepted+active method
  (Pay with card / Pay with PayPal / EFT bank details); redesigned to mirror the guest page.
- Platform PayPal wired (migration `20260709120000`) — creds configured (sandbox).
- Admin Overview: **Products** card (subs + one-off sales) + **Test/Live toggle** so test
  purchases show. New products default to Paystack + EFT.
- Support inbox (host↔Wielo) exists via `conversations.channel='platform'`, host-based
  (host_id = host, guest_id = "Wielo Support" account). Rich `payment_link` system card
  renders in `ChatMessageWall`.

## Founder DECISIONS (confirmed 2026-07-09)
- **Inbox threading = USER-BASED** (not host-only). Any buyer with an account gets a Wielo
  thread + purchase card; no account → email only, prompting signup.
- **Overview = Test/Live toggle** (done this session).

---

## 1. User-based Wielo thread (the rearchitecture)
Today a platform thread is host-based (`conversations.host_id` NOT NULL). A product buyer is
often NOT a host. Make the Wielo↔user thread keyed on the USER so any buyer gets one.

- **Model:** introduce a single system "Wielo" host (a `hosts` row owned by the Wielo Support
  user) to satisfy `host_id NOT NULL`, and put the BUYER in `guest_id`. So a platform thread =
  `{ host_id = Wielo-host, guest_id = <buyer user>, channel='platform' }`. The buyer then sees
  it in their **portal inbox** (`/portal/inbox`, loads by guest_id) AND admin sees it in
  `/admin/inbox` (channel='platform').
  - Alternative considered: add nullable `conversations.user_id` for hostless threads. The
    Wielo-host approach reuses the existing two-seat model + both inbox load queries with
    less churn. Pick one; the Wielo-host approach is recommended.
- **Migrate** the existing host-based Wielo threads to the new shape (pre-MVP, safe to
  reshape). Update `lib/inbox/platform-thread.ts`: `ensureWieloUserThread(userId)` find-or-
  create by (guest_id=userId, host_id=Wielo-host, channel='platform'); keep pinned + seeded
  welcome. Keep `adminPostToHostThread` / `adminPostPaymentLinkToHostThread` working (retarget
  by user).
- **RLS:** ensure the buyer (as guest_id) can read/post; Wielo Support posts via service role.
- **Both inbox surfaces** must show platform threads: portal inbox (guest_id) + host dashboard
  inbox (if the buyer is also a host, decide whether to show it there too or only in portal —
  recommend PORTAL as the single home, matching the founder's portal Inbox consolidation).
- **Verify** existing host↔Wielo support still works after the migration (don't regress the
  shipped feature).

## 2. Purchase-confirmation notification hook (all methods)
Add ONE shared `onProductOrderPaid(orderId)` called by EVERY settle path
(`confirmProductOrderByReference`, webhook `processProductEvent`, `capturePayPalProductOrder`,
EFT mark-paid, manual). It must be idempotent (guard on an already-notified flag on the order,
e.g. `product_orders.notified_at`). It:
1. **Posts a "Purchase confirmed" card** to the buyer's user thread (§1) — product name,
   amount, method, order ref, an **invoice download** link (the minted `wielo_invoices`
   hosted page), and (if no account) a "create your account" CTA. Reuse the system-card
   pattern (new `system_event='purchase_confirmed'` in `ChatMessageWall`).
2. **Sends an email** (the deep templated queue: add a registry entry + resolver +
   template — see `lib/email/registry.ts`, `resolvers/`, `drain.ts`). Content: product,
   amount, invoice link, and account CTA (log in → transaction history / or register). Works
   whether or not the buyer has an account.
3. Is best-effort — a notification failure must NEVER roll back a captured payment.

## 3. Statuses: success / failed / refunded — tracked + actionable
- **Failed:** the pending `platform_ledger` row / order stays visible; give the admin a
  **"Regenerate + resend pay link"** action (ledger row menu or the orders view) that mints a
  fresh pay-link for the SAME product/buyer and posts it to their inbox + email (reuse the
  `payment_link` card + `adminSendPaymentLinkToInboxAction`).
- **Refunded:** a refund on a product order records a refund ledger row + credit-note doc
  (host-ledger parity already exists for manual; ensure a product refund path posts an inbox
  card + email too).
- Every state transition is recorded on the ledger under the buyer's account (already the
  case for charges; add failed/refunded surfacing + notifications).

## 4. Buyer transaction history (in their account)
- When the buyer has an account, their settings should show their Wielo transaction history
  (their product orders + invoices to download). Add a "Billing / Purchases" section under
  `/dashboard/settings` (host) and/or `/portal/settings` (guest) listing their
  `product_orders` + `wielo_invoices` with download links. The inbox card + email deep-link
  here.
- No account → the email CTA routes to signup; after registering, the same history + their
  now-created inbox thread are populated.

## 5. Pay page — method buttons (mostly done; confirm)
- The pay page already houses a button per method the product accepts AND the platform has
  set up: **Pay with card** (Paystack), **Pay with PayPal**, and **EFT** bank details. EFT is
  the default rail (new products default to it; admin can deactivate per product). Confirm the
  gating reads: show a method IFF `product.payment_methods.includes(m)` AND that method is
  enabled/configured platform-wide. (For EFT, platform EFT must be enabled + bank details set.)

## 6. Build order
1. §1 user-based thread + migration (foundation; verify support inbox not regressed).
2. §2 notification hook (email + card) wired into all settle paths.
3. §3 failed→regenerate + refunded notifications.
4. §4 buyer transaction history in settings.
5. §5 confirm pay-page gating.
Each slice: tsc + lint + `pnpm build` green; verify live (admin + a real/seeded buyer, temp
super_admin grant → revoke); commit + push.

## 7. Gotchas
- Email needs `RESEND_API_KEY` (set in prod; may be unset in dev — verify the ENQUEUE in dev,
  the SEND in prod).
- Idempotency: multiple settle paths can fire for one order (webhook + return) — guard the
  notification with `notified_at` so the buyer isn't double-messaged.
- Don't regress the shipped host↔Wielo support inbox when reshaping the thread model.
- See memory: [[reference-platform-support-inbox]], [[project-ledger-payments-affiliate-plan]],
  [[project-affiliate-hardening-plan]] (affiliate is AFTER this).
