# Create-data layout rollout — audit & approval list

**Standard pattern** (founder directive 2026-07-13, memory `feedback-create-data-default-layout`):
left-rail step-tabs · live per-step sub-hints · health ring · identity bar with
autosave indicator · one panel at a time · final **Review** step with per-row
quick-edit jumps · shared `useAutosaveDraft` + `ResumeDraftBanner` · **one**
primary button on the last step.

This audit lists every create/edit surface on the host dashboard and proposes
which get the pattern. **Tick the ones to convert.**

---

## ✅ Already on the pattern (done)
| Surface | File |
|---|---|
| Add-ons editor | `dashboard/addons/AddonEditor.tsx` |
| Specials / deals editor | `dashboard/specials/_components/SpecialEditor.tsx` |
| Manual booking (create) | `dashboard/bookings/new/ManualBookingForm.tsx` |

## 🟢 Strong candidates — full-page multi-step create/edit (recommend convert)
| # | Surface | File | Notes |
|---|---|---|---|
| 1 | **Quote** (new + edit) | `dashboard/quotes/QuoteForm.tsx` | **APPROVED — in progress.** Shared component (also used by looking-for respond) → build a **page vs embedded** layout variant so respond keeps its embedded look. Live-pricing money path — careful. |
| 2 | **Listing editor** (the real "new/edit listing") | `dashboard/properties/[id]/edit/Editor.tsx` (596 L, already ~tabbed) | The 2-field "new listing" form just makes a draft and redirects *here*. Aligning this editor to the left-rail pattern IS the real listing create/edit experience. |
| 3 | **Room editor** (create/edit a room) | `dashboard/properties/[id]/edit/rooms/[roomId]/RoomEditor.tsx` (682 L) | Substantial per-room form. Good fit. |

## 🔵 Already multi-step wizards — align styling to the standard (lower priority)
| # | Surface | File | Notes |
|---|---|---|---|
| 4 | Host onboarding wizard | `dashboard/setup/SetupWizard.tsx` (669 L, already stepped) | Already a wizard; re-skin to the exact rail/Review/autosave standard for consistency. |
| 5 | Website setup wizard | `dashboard/website/_wizard/WebsiteWizard.tsx` (+`WizardSidebar`) | Already has a left-rail sidebar. **Website/builder is out of scope** per prior sweeps — align only if you want. |

## 🟡 Modal / dialog-based create-edit — need the "modal variant" decision first
These live in list-managers with a dialog or inline row editor. The pattern can
apply, but a modal needs its own rule: **persist-on-close + resume banner on
dialog re-open** (not page load). Decide once, then apply to all.
| Surface | File |
|---|---|
| Coupons (CouponDialog) | `dashboard/coupons/CouponsManager.tsx` |
| Rooms quick-add / settings | `dashboard/rooms/ListingSettingsDialog.tsx`, `.../tabs/RoomRowEditor.tsx`, `RoomsManager.tsx` |
| Seasonal pricing | `dashboard/seasonal-pricing/SeasonalPricingManager.tsx` (2021 L, dialog-heavy) |
| Banking dialogs | `settings/banking/_components/{BankAccountDialog,PaymentGatewayDialog,PaymentLinkDialog}.tsx` |
| Staff · Alerts · Inbox templates · Listing extras · iCal feeds | `staff/StaffManager`, `looking-for/alerts/AlertsManager`, `inbox/templates/TemplatesManager`, `listing-extras/ExtrasManager`, `calendar-sync/FeedManager` |

## ⚪ Doesn't fit — minimal entry points / settings / list managers (leave as-is)
| Surface | File | Why |
|---|---|---|
| "New listing" (name + category) | `properties/new/NewListingForm.tsx` | 2-field draft creator → redirects into the listing editor (#2). Nothing to step. |
| "New business" | `settings/businesses/_components/BusinessForm.tsx` | Short single form. |
| Data / GDPR request | `settings/data/RequestForm.tsx` | Simple settings form. |
| Tracking pixels | `dashboard/tracking/TrackingForm.tsx` | Settings form. |
| Media manager | `dashboard/media/HostMediaManager.tsx` | Asset browser, not a create-wizard. |
| Website-editor forms (SEO, Settings, Domain, Blog, Pages, Responses) | `dashboard/website/[websiteId]/(editor)/*` | Website/builder — out of scope per prior sweeps. |

---

## Proposed order (pending your ticks)
1. **Quote** — layout variant (approved, doing now).
2. **Listing editor** (#2) + **Room editor** (#3) — the real listing/room create-edit.
3. **Onboarding wizard** (#4) re-skin.
4. **Modal-variant decision**, then the 🟡 group (coupons, rooms quick-add, seasonal, banking, managers).
5. Leave ⚪ as-is.
