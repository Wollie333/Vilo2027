# Lifecycle — Auto-save drafts (zero-loss editing)

**Goal (founder, 2026-07-13):** a host mid-creating/editing an entity who
navigates away without saving must never lose their work. On return they get a
clear "Resume where you left off?" prompt — never a silent surprise.

Status: **LIVE** on the two full-page step-editors — **add-ons** and **specials
(deals)**. Rooms & coupons (modal editors) are a documented follow-up.

---

## Architecture — two layers behind one hook

### Layer A — instant local (client, no backend)
`useAutosaveDraft` debounce-persists the live form snapshot to `localStorage`
(500 ms) under key `wielo:draft:{userId}:{entityType}:{entityId|"new"}:{scopeId|"-"}`.
Instant, offline-safe, survives route change / tab close within the same browser.

### Layer B — durable server (cross-device)
The same hook syncs to the `form_drafts` table (2.5 s debounce + a
`navigator.sendBeacon('/api/drafts')` flush on unload). Survives cache clears and
follows the user across devices. On mount the hook reconciles the **newer** of
the local vs server draft.

```
form_drafts (migration 20260713130000)
  id, user_id → auth.users, entity_type, entity_id, scope_id, payload jsonb, updated_at
  UNIQUE NULLS NOT DISTINCT (user_id, entity_type, entity_id, scope_id)   -- PG15: one live draft/target, stable upsert even for "new"
  RLS: own-rows only (select/insert/update/delete where auth.uid() = user_id)
```

`entity_type` is allow-listed (`addon | special | room | coupon`) in
`lib/drafts/store.ts` so junk can't be written.

---

## Files

| Concern | File |
|---|---|
| DB table + RLS | `supabase/migrations/20260713130000_form_drafts.sql` |
| Shared store (upsert/delete/load, target validation) | `apps/web/lib/drafts/store.ts` |
| Server Actions (during-edit sync) | `apps/web/lib/drafts/actions.ts` |
| Unload beacon endpoint | `apps/web/app/api/drafts/route.ts` |
| Shared hook | `apps/web/components/drafts/useAutosaveDraft.ts` |
| Resume banner | `apps/web/components/drafts/ResumeDraftBanner.tsx` |
| Pilot wiring | `apps/web/app/[locale]/dashboard/addons/AddonEditor.tsx` (+ `[id]/page.tsx`) |
| Specials wiring | `apps/web/app/[locale]/dashboard/specials/_components/SpecialEditor.tsx` (+ `new` / `[id]/edit` pages) |

---

## Flow

1. **Page load (server):** the editor route calls `loadFormDraft(supabase, userId, target)`
   and passes `userId` + `serverDraft` to the client editor.
2. **Mount:** the hook captures a **baseline** = the loaded entity's serialized
   form, and reconciles local vs server drafts. A resume banner shows **only if**
   the candidate draft actually differs from the baseline (so an unchanged editor
   never nags).
3. **Editing:** whenever the form diverges from the baseline, the hook persists
   (local 500 ms, server 2.5 s). It never writes while the form equals the
   baseline — so a saved/unchanged form leaves no draft.
4. **Leave:** `visibilitychange=hidden` / `pagehide` flush local + beacon; a
   component unmount (client-side route change, which fires no `pagehide`) does a
   final local + server flush.
5. **Return:** banner → **Restore** applies the payload into the form (single
   `setForm` for specials; field setters for add-ons) and dismisses; **Discard**
   deletes local + server draft and rebaselines.
6. **Save:** the entity's create/update action succeeds → the editor calls
   `draft.clearSaved()`, which deletes both layers and rebaselines to the just-saved
   state. Guards ensure a debounced timer scheduled just before the Save can't
   resurrect the cleared draft.

---

## What each editor protects

- **Add-on** (`AddonDraftPayload`): name, description, category, pricing model +
  unit price, min/max qty, custom-qty, stock, lead time, daily capacity, VAT flag.
  Image / active / availability persist via their own immediate actions → excluded.
- **Special**: the whole `SpecialInput` form object (single snapshot / single
  `setForm` restore).

---

## Verification (done live, both editors)

Edit a field → localStorage key + `form_drafts` row both written → navigate away
→ return → banner restores state → Save clears both layers (no stale resume) →
Discard clears both layers. All confirmed against the live cloud DB.

---

## Follow-ups

- **Rooms & coupons** are modal/inline editors (`RoomsGroupCard`, `CouponDialog`).
  The generic hook works there too, but the UX needs a decision: persist on dialog
  close, and show the banner on dialog **reopen** (not page load). Scoped for a
  later pass — `scope_id` = property_id disambiguates two "new room" drafts.
- **TTL/cleanup:** drafts are cleared on save/discard, but abandoned ones linger.
  A periodic prune (e.g. delete `form_drafts` older than 30 days) is worth adding
  before launch to avoid clutter.
- **`draft` status vs recovery draft:** specials already have an intentional
  `draft` *status*; this autosave is a separate *recovery* layer for unsaved edits.
