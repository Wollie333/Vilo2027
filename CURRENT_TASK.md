# Vilo — Current Task

**Session Date:** 2026-06-05
**Branch:** `main`
**Task:** App-wide shell redesign (header + collapsible Gmail-style sidebar) + New Booking 5-step wizard
**Design Reference:** `C:\Users\Wollie\Downloads\New Booking Page v3.html`

---

## 🎯 Goal

Redesign the app shell across **host dashboard, guest portal, and super admin** to match the
"Classic shell" in the reference: a full-width top header (hamburger · logo · centered search ·
context actions · avatar) above a row of `[collapsible Gmail-style sidebar | content]`. The
sidebar collapses 248px ↔ 76px icon-rail via the header hamburger (persisted). Then rebuild the
**New Booking** page as the 5-step wizard, wired to the real server actions/data.

### Locked decisions
- **Collapse = 76px icon rail** (not hidden), toggled by the header hamburger, persisted to localStorage.
- **Keep** workspace switcher + identity (top of sidebar) and plan card (bottom), restyled to the Gmail look.
- **Context compose button:** Dashboard = "New booking" · Portal = "Browse stays" · Admin = "Quick create" menu.
- Header centered search opens the existing global/entity search.

---

## 📋 Phases (commit after each)

- [x] **Phase 1 — Shared foundation** ✅
  - `app/_components/ClassicShellFrame.tsx` — header-on-top + row(sidebar+content), internal scroll.
  - `app/_components/AppHeader.tsx` (hamburger · brand · centered search · right-actions slot).
  - `app/_components/GmailNav.tsx` reusable sidebar primitive (compose · item renderer with
    icon/label/count/dot · section labels/dividers · collapse-to-76px-rail via `useSidebarToggle`).
  - `SidebarToggle.tsx`: added `HeaderMenuToggle` hamburger; `collapsed` now = rail mode for the
    new shell. (Old `AppShellFrame` kept until portal/admin migrate.)
- [x] **Phase 2 — Host dashboard** ✅ — `dashboard/_components/Sidebar.tsx` rebuilt on GmailNav
  (compose "New booking", switcher + setup nudge in `top`, plan card in `bottom`); layout uses
  `ClassicShellFrame` + `AppHeader` (EntitySearch centered, NotificationBell + New booking + AvatarMenu).
  Removed orphan `Topbar.tsx`. Build + lint green.
- [x] **Phase 3 — Guest portal** ✅ — `PortalSidebar` rebuilt on GmailNav (compose "Browse stays",
  switcher + identity in `top`, Discover section, footer Settings/Help/Sign out); layout uses
  ClassicShellFrame + AppHeader (search → browse, notifications bell, AvatarMenu). `AvatarMenu`
  generalized with `profileHref`/`settingsHref`. Build green.
- [x] **Phase 4 — Super admin** ✅ — `AdminSidebar` rebuilt on GmailNav; admin layout converted
  from its bespoke inline shell to ClassicShellFrame + AppHeader (role-session chip + AvatarMenu;
  impersonation + broadcast banners). Deleted orphaned `AppShellFrame.tsx`, `AdminTopbar.tsx`,
  `Topbar.tsx`, and the unused `SidebarToggleButton`/`SidebarRevealButton`.

### Founder design tweaks (applied across the unified theme)
- Removed the sidebar compose button ("New booking" / "Browse stays") on **all** portals.
- Removed the plan/upgrade card from the sidebar.
- Removed the green "New booking" button from the dashboard header.
- Added a thin, refined scrollbar (`.thin-scroll`) on the sidebar nav + content scroll.
- [x] **Phase 5 — New Booking wizard** ✅ — `ManualBookingForm` re-laid into the 5-step wizard
  (Property → Dates & guests → Guest → Price & extras → Payment) with a clickable progress stepper
  and Back/Continue nav showing the live total. **All original logic preserved** — listing/room
  selection, availability calendar, past-guest search, server-side pricing, add-ons/custom fees,
  the three payment states, and `createManualBookingAction`. Per-step validation gates Continue;
  the summary sidebar was replaced by the inline "What happens next" card from the design.

---

## ✅ ALL 5 PHASES COMPLETE — unified shell theme + New Booking wizard. Build + lint green.

---

## 📝 Session Notes
- Shell is shared via `AppShellFrame` + `SidebarToggleProvider`. Three sidebars + dashboard `Topbar`.
- Design tokens (brand colors, rounded-card/pill, font-display) already exist in Tailwind config.
