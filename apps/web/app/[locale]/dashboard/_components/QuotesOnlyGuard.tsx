"use client";

import { useEffect } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import {
  QUOTES_ONLY_HOME,
  isQuotesOnlyAllowedPath,
} from "@/lib/host/accountScope";

/**
 * Client route guard for quotes-only accounts. The sidebar already hides the
 * host surfaces, but a direct URL (typed / bookmarked) to a host-only route is
 * bounced back to the quotes home. The underlying data is RLS-scoped regardless,
 * so this is a UX guard, not the security boundary.
 */
export function QuotesOnlyGuard({ active }: { active: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (active && !isQuotesOnlyAllowedPath(pathname)) {
      router.replace(QUOTES_ONLY_HOME);
    }
  }, [active, pathname, router]);

  return null;
}
