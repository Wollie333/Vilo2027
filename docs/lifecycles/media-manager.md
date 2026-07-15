# Media manager — lifecycle & audit

> Deep audit 2026-07-16. **Verdict: it works, but it is NOT the unified single
> source of truth the tagline implies** — it's a read-only aggregator over separate
> storage silos. Fixed one real trust bug (misleading delete copy). Making it a true
> SSOT is a multi-day epic (backlog below), not an MVP-blocker: uploads/list/delete
> per surface all function today.

## As-built (the silos)
Media lives in **3 buckets + separate tables/JSONB**, not one store:
- **Listing/room photos** → bucket `listing-photos`, table `property_photos` (was
  `listing_photos`). Concurrent upload helper `components/listing/photoUpload.ts`
  `uploadListingPhotos`; actions in `properties/[id]/edit/actions.ts`.
- **Website assets** → bucket `website-assets`, metadata table `website_media`
  (`20260618000700`). Upload via `createWebsiteMediaUploadUrl`→`registerWebsiteMediaAction`.
- **Brand assets** (logo/favicon/apple-icon) → bucket `website-assets`, stored as JSONB
  keys on `host_websites.brand` (NO `website_media` row).
- **Financial-doc logo** (quote/invoice/credit-note PDFs) → separate bucket `host-logos`,
  column `host_business_details.logo_path`.

`dashboard/media/` (`loadHostMedia.ts` + `HostMediaManager.tsx`) aggregates only
`website-assets` objects + `property_photos` into two tabs; it does NOT surface brand
logo/favicon or the financial logo.

## Reuse
A media picker exists (`components/website/MediaLibrary.tsx`, builder `MediaLibraryModal`)
but reads **one website's** `website-assets` folder only. The host-level media manager and
listing/room photos have **no picker** — every "add" is a fresh upload. So the same photo
used on a listing and a website page becomes two objects in two buckets.

## Fixed this pass
- **Misleading delete copy** (`HostMediaManager.tsx` `remove()`): the confirm said "It's
  removed wherever it's used", implying a safe cascade — but `deleteWebsiteMediaAction` only
  deletes the object + metadata row with NO reference update, so any page/section referencing
  it shows a broken image. Corrected to an honest warning ("…that page will show a broken
  image until you replace it there.").

## Backlog to become a true SSOT (epic — surfaced, not built)
1. **Unify storage** — one media bank (single bucket or a `host_media` table indexing all
   objects) instead of 3 buckets + `property_photos`/`website_media`/`brand` JSONB.
2. **Complete the manager** — surface brand logo/favicon + the financial `host-logos` in
   `dashboard/media`.
3. **Cross-surface picker** — let listing/room photos, website images, brand and financial
   logo pick from ONE bank (no duplicate re-uploads).
4. **Brand assets should write a `website_media` row** (currently bypass it → un-tracked).
5. **Reference-counting on delete** — block or warn with the exact usages before deleting;
   never silently orphan. (Copy is now honest; a real usage-check is still owed.)
6. **Per-plan storage quota** — none today; only per-file client caps (6/8 MB) + a 5 MB
   file limit on `host-logos`. No aggregate byte metering per host/plan.

None of the above is MVP-blocking (per-surface upload/delete work); they're the gap between
"works" and the founder's "one media bank" vision.
