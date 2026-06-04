# Guest Portal — QA Verification

Tracks the 100%-verification pass over the guest portal (`apps/web/app/portal/**`
plus the guest-facing booking/quote/enquiry flows). Mirrors the
`HOST_QA_PROGRESS.md` discipline: each feature is checked against the platform
invariants below before it's marked clean.

## Invariants checked per feature
- `export const dynamic = "force-dynamic"` on every page that reads Supabase.
- Reads scoped to the signed-in guest — `guest_id = auth.uid()` via RLS or an
  explicit filter; no service-role reads of guest-owned data except where a
  secret (e.g. token-gated access) justifies it.
- Embeds FK-pinned where a table has multiple FKs to the same parent
  (see memory "dashboard query gotchas").
- All confirms/destructive prompts go through the canonical `modal` /
  `FormModal` — never `window.confirm`.
- Dynamic brand name (`getBrandName` / `<BrandName>`) — no hardcoded "Vilo"/"VILO".
- A published `help_articles` row (audience `guest`/`both`) per feature.
- No placeholder/static data; mobile-first.

## Status

| Feature | Route(s) | force-dynamic | RLS/scoping | Modals | Brand | Help | Notes |
|---|---|---|---|---|---|---|---|
| Overview + Book again | `/portal` | ✅ | ✅ guest_id | n/a | ✅ | (book flow) | dedupes recent stays by slug |
| Trips list | `/portal/trips` | ✅ | ✅ guest_id | n/a | n/a | ✅ existing | Book again deep-links to `/book?guests=` |
| Trip detail | `/portal/trips/[id]` | ✅ | ✅ guest_id; access details via admin (secret-gated) | ✅ cancel/refund | ✅ | ✅ existing | Book again added to action bar |
| Quotes list | `/portal/quotes` | ✅ | ✅ guest_read_own_quotes | n/a | n/a | ✅ | status-grouped pills |
| Quote detail | `/portal/quotes/[id]` | ✅ | ✅ RLS + ownership re-check on write | ✅ decline | ✅ `<BrandName>` | ✅ | accept/decline session-gated |
| Inbox + thread | `/portal/inbox` | ✅ | ✅ guest_id | n/a | n/a | ✅ existing | reply + mark-read |
| Reviews | `/portal/reviews` | ✅ | ✅ guest_id | n/a | n/a | ✅ existing | |
| Browse (in-portal) | `/portal/browse` | ✅ | public published listings | n/a | ✅ | (explore) | shares searchListings + BrowseResults |
| Notifications inbox | `/portal/notifications` | ✅ | ✅ own | n/a | ✅ | n/a | relocated from /account; sidebar Bell + unread badge |
| Settings · Profile | `/portal/settings` | ✅ | ✅ self | n/a | ✅ | ✅ existing | |
| Settings · Notifications | `/portal/settings/notifications` | ✅ | ✅ self | n/a | ✅ | ✅ | preferences |
| Settings · Data & privacy | `/portal/settings/data` | ✅ | ✅ self | (delete via section) | ✅ | ✅ existing | POPIA |
| Settings · Security | `/portal/settings/security` | ✅ | ✅ self (auth.updateUser) | n/a | n/a | ✅ | change email (confirm) + password |
| Request a quote (authed + anon) | listing `/book` enquiry | n/a | find-or-create by email | ✅ FormModal | ✅ | ✅ | authed skips contact fields → inbox |

## Known follow-ups (out of this pass)
- The public token quote page `/q/[id]/[token]` now renders the dynamic brand
  name (no hardcoded "VILO").
- Portal sidebar now has a **Notifications** entry (Bell icon) with a live
  unread badge, linking to `/portal/notifications` — also reachable from the
  Settings → Notifications tab.
