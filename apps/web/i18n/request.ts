import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

type Messages = { [key: string]: string | Messages };

// Deep-merge the locale catalog over English so EACH missing key falls back to
// English individually (not whole namespaces). This is what lets partial
// translations work — a locale can translate some keys in a namespace and the
// rest render in English, which is exactly how the admin portal / bulk import
// fills things over time.
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const b = out[key];
    const o = override[key];
    out[key] =
      typeof b === "object" && typeof o === "object" ? deepMerge(b, o) : o;
  }
  return out;
}

// Per-request message loading (the module next.config points the plugin at).
// English is the source catalog; other locales deep-merge over it.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;

  const en = (await import("../messages/en.json")).default as Messages;
  const messages =
    locale === "en"
      ? en
      : deepMerge(
          en,
          (await import(`../messages/${locale}.json`)).default as Messages,
        );

  return { locale, messages };
});
