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
- [ ] **Phase 4 — Super admin** — rebuild `admin/_components/AdminSidebar.tsx`; wire header.
- [ ] **Phase 5 — New Booking wizard** — rebuild `dashboard/bookings/new/ManualBookingForm.tsx`
  as Property → Dates & guests → Guest → Price & extras → Payment, wired to `new/actions.ts`.

---

## 📝 Session Notes
- Shell is shared via `AppShellFrame` + `SidebarToggleProvider`. Three sidebars + dashboard `Topbar`.
- Design tokens (brand colors, rounded-card/pill, font-display) already exist in Tailwind config.
