import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

// Per-request message loading (the module next.config points the plugin at).
// English is the source catalog; for any other locale we spread the locale's
// catalog over the full English one, so any not-yet-translated key falls back to
// English instead of rendering a raw key. (Shallow spread is fine while non-en
// catalogs are whole-namespace or empty; switch to a deep-merge once we ship
// partial namespaces — tracked in the i18n plan.)
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;

  const en = (await import("../messages/en.json")).default;
  const messages =
    locale === "en"
      ? en
      : { ...en, ...(await import(`../messages/${locale}.json`)).default };

  return { locale, messages };
});
