// TEMP frontend locks (2026-07) — the guest-facing frontend is pinned to ZAR +
// English while we finish polishing currency conversion + translations. Flip a
// flag back to `true` to re-enable that switcher; nothing else needs to change:
//   • the switchers self-hide when their flag is off, and
//   • CurrencyProvider forces ZAR (ignoring any saved cookie) when currency is off.
// English is already the firm default (i18n/routing.ts → localeDetection:false),
// so hiding the language switcher is all that's needed there.
//
// See CHANGELOG 2026-07-02.
export const CURRENCY_SWITCHER_ENABLED = false;
export const LANGUAGE_SWITCHER_ENABLED = false;

// LAUNCH THEME GATE (2026-07) — while we get ONE theme working 100% end-to-end
// (wizard → published booking-integrated site), Royal is the SOLE theme offered
// to hosts. The other themes (oceansview/safari/sabela/marmalade) stay fully
// built in the codebase but are HIDDEN from every host-facing picker (wizard
// theme step, editor theme gallery, brand page) — they're filtered out of
// `loadActiveThemes()`, so nothing else needs to change. Already-published sites
// on another theme still render; only the PICKER is gated.
//
// To bring a theme back: add its slug here. An empty array disables the gate
// (every active site_themes row is offered again). Founder directive — expand
// only once Royal is signed off.
export const LAUNCH_THEME_SLUGS: readonly string[] = ["royal"];
