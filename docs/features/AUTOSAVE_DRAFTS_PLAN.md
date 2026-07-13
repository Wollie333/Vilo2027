# Plan: auto-save drafts across the builder editors

> **Founder ask (2026-07-13):** when a user is *in the middle of creating or
> editing* a **special / room / add-on / coupon** (and other entities) and
> **navigates away without saving**, their work should be preserved as a draft so
> they can come back and finish where they left off. Never lose in-progress work.

Status: **PLANNED — pick up in a fresh session.** Nothing built yet.

---

## Goal

Zero-loss editing. Any editor form that isn't finished when the user leaves (route
change, tab close, accidental back) is recoverable on return, with a clear
"Resume where you left off?" prompt — not a silent surprise.

Scope (entities with a create/edit editor): **specials, rooms, add-ons, coupons**
first; then listings/properties, policies, website pages, looking-for, etc.

## Design — two layers (recommend both, ship Layer A first)

### Layer A — instant local autosave (client, no backend)
A shared hook debounce-persists the live form state to `localStorage`, keyed by
`(userId, entityType, entityId|"new", scopeId)`. Also flushes on
`visibilitychange=hidden` and `beforeunload`. On mount, if a stored draft is newer
than the loaded server value, the editor shows a **Resume banner** (Restore /
Discard). Instant, offline-safe, survives a route change or tab close. Device-local
only; lost if the browser cache is cleared.

### Layer B — durable server draft (cross-device)
A **generic** `form_drafts` table + server actions, so one mechanism serves every
editor. The hook also flushes to the server (longer debounce + on unload via
`navigator.sendBeacon` / a server action). On mount, reconcile local vs server and
take the newest. Cross-device, survives cache clears.

```sql
create table form_drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,      -- 'special' | 'room' | 'addon' | 'coupon' | ...
  entity_id   uuid,               -- null = a brand-new create; set = editing a row
  scope_id    uuid,               -- e.g. property_id (disambiguates two "new room" drafts)
  payload     jsonb not null,     -- the serialised form state
  updated_at  timestamptz not null default now(),
  unique (user_id, entity_type, entity_id, scope_id)  -- one live draft per target
);
-- RLS: user_id = auth.uid() for select/insert/update/delete (own drafts only).
```

## Shared hook (both layers behind one API)

```ts
const { hasDraft, restore, discard, savedAt, status } = useAutosaveDraft({
  entityType, entityId, scopeId,   // identity of the thing being edited
  value: form, onRestore: setForm,  // controlled form state in/out
  enabled,                          // e.g. false until a property is chosen
  exclude,                          // keys NOT to persist (file blobs — store the path only)
});
```
- Debounced persist on `value` change (Layer A ~400ms, Layer B ~3s + on unload).
- On mount: surface `hasDraft` + `savedAt` so the editor renders the resume banner.
- The entity's **create/update server action clears the matching draft on success**
  (so a saved entity never leaves a stale "resume" prompt).

## Wiring (per editor)
`SpecialEditor` is the natural pilot (complex, just enriched). Then the room,
add-on and coupon editors, each: mount the hook, render the resume banner, and
clear the draft in the save action.

## Open questions (decide with founder at session start)
1. **Local-only (Layer A) or cross-device (Layer A+B) for MVP?** A alone covers
   "leave and come back in the same browser" with zero backend.
2. **Relationship to the existing `draft` *status*** (specials already save an
   explicit draft row): autosave is a *recovery* layer for unsaved edits, distinct
   from an intentionally-saved draft. Keep both? Add "Save draft" everywhere?
3. **Resume UX:** banner ("Unsaved changes from {time} — Resume / Discard"),
   recommended — vs silent auto-restore.
4. **TTL:** expire drafts after N days (14/30) via a cron to avoid clutter.
5. **Files/blobs:** exclude hero-image uploads; persist only the stored path.
6. **Conflict:** if the server row changed since the draft, prefer the draft (it's
   the user's unsaved work) but warn.

## Verify (each wired editor)
Start creating → fill fields → navigate away → return: banner restores state.
Save the real entity → draft cleared (no lingering prompt). Edit an existing row →
change fields → leave → return: recovers. (Follow the founder rule — verify live in
the real editor, not just unit tests.)

## Related
- Specials editor + lifecycle: `docs/lifecycles/specials.md`, memory `project-specials-audit`.
- Add-ons refine/audit is the *other* next-session item — do the add-on editor
  autosave wiring alongside that audit if convenient.
