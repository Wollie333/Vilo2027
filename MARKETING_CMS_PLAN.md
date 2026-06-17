# Affiliate Marketing CMS — build plan

**Goal:** Admins manage affiliate marketing material (banners, social posts,
email templates, AI prompts, videos, blogs) from the admin area, mirroring the
guest portal's design. Each asset can carry **any combination** of a file, an
external URL, and text content. Affiliates see the published material on
`/portal/affiliates/marketing`, rendered per the design with their referral link
baked in.

Each phase ends in a commit = a save point.

---

## Phase 0 — Schema ✅ (done)

`20260617000050_marketing_assets_content.sql` — `marketing_assets` gains `body`
(text content) + `link_url` (external URL); `file_path`/`file_url` made
nullable. Categories: `banner | social | email | prompt | video | blog`.
Applied to the linked remote. **Remaining:** regenerate `database.types.ts`.

## Phase 1 — Admin sub-tabs + Marketing management shell

- `AffiliateAdminNav` sub-tab component: **Overview · Marketing · Terms ·
  Settings** (replaces the header link buttons), used across the admin
  affiliates area.
- `/admin/affiliates/marketing/page.tsx` — server: load all assets grouped by
  category; render a management board mirroring the portal layout (one section
  per content type) with Add / Edit / Delete / show-hide per asset.
- **Save point:** commit.

## Phase 2 — Marketing CRUD (actions + forms + upload)

- Server actions (`withAdminAudit`): `upsertMarketingAssetAction`,
  `deleteMarketingAssetAction`, `toggleMarketingAssetAction`, and a
  `createMarketingUploadUrlAction` (service-role signed upload URL on the
  `marketing-assets` bucket — browser uploads directly, avoiding the Vercel body
  cap, then registers `file_path`/`file_url`).
- Client manager: `FormModal` create/edit form with category select + title +
  description + body (textarea) + link URL + optional file upload; delete +
  active toggle.
- **Save point:** commit.

## Phase 3 — Portal Marketing tab render

- Rewrite `/portal/affiliates/marketing/page.tsx` to group by category and
  render per the design: banners (image + download + embed), email templates
  (subject + body + copy), social posts (caption + copy), AI prompts (copy),
  videos (embed/link), blogs (link card + excerpt).
- Generalise `MarketingAssetCard` to handle file / URL / text assets.
- **Save point:** commit.

## Phase 4 — Verify + ship

- Regenerate types, `pnpm type-check`, `pnpm lint`, `pnpm build`.
- Read-only verify of `marketing_assets` shape on the live DB.
- Push `main`.
