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
