import { defineRouting } from "next-intl/routing";

// Single source of truth for locales + routing, shared by the middleware, the
// navigation wrappers (i18n/navigation.ts) and the request config (request.ts).
//
// localePrefix: "as-needed" → the default locale (en) keeps the CURRENT URLs
// with NO prefix (/listing/x stays /listing/x); other locales are prefixed
// (/af/listing/x). This preserves every existing English URL while giving real
// per-language URLs + hreflang for the others.
export const routing = defineRouting({
  locales: ["en", "af", "fr", "de", "pt"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
