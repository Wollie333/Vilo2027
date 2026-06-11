import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Locale-aware replacements for next/link + next/navigation. Under
// localePrefix:"as-needed" these behave exactly like the plain next/* helpers
// for the default locale, so call sites can migrate incrementally (a surface at
// a time) rather than in one big sweep.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
