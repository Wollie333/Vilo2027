import en from "./en.json";

// Minimal typed translation helper. Keeps every UI string out of components
// (RULES.md §10) and sources from en.json — the same shape the web app's
// translation portal consumes. Swap the backing store for a full library later
// without touching call sites.
type Dict = { [key: string]: string | Dict };

const dictionaries: Record<string, Dict> = { en };
let locale = "en";

export function setLocale(next: string) {
  if (dictionaries[next]) locale = next;
}

/** Resolve a dotted key (e.g. "auth.signIn"); falls back to the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[locale] ?? dictionaries.en;
  const raw = key.split(".").reduce<string | Dict | undefined>((acc, part) => {
    if (acc && typeof acc === "object") return acc[part];
    return undefined;
  }, dict);

  let value = typeof raw === "string" ? raw : key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(
        new RegExp(`{{\\s*${name}\\s*}}`, "g"),
        String(replacement),
      );
    }
  }
  return value;
}
