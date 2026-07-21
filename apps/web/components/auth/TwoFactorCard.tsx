import { ChevronRight, ShieldCheck, ShieldOff } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { hasVerifiedFactor } from "@/lib/auth/mfa";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Entry point to /account/security, dropped into each settings area.
 *
 * The security page itself is shared by every account type, so this is the only
 * per-shell piece — without it the whole feature would exist and be reachable by
 * nobody, which is the failure mode this codebase is most prone to.
 */
export async function TwoFactorCard() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const enabled = await hasVerifiedFactor(user.id);

  return (
    <Link
      href="/account/security"
      className="group flex items-center gap-3.5 rounded-card border border-brand-line bg-white px-5 py-4 shadow-card transition hover:border-brand-primary/40"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${
          enabled
            ? "bg-[#ECFDF5] text-[#047857]"
            : "bg-brand-accent text-brand-secondary"
        }`}
      >
        {enabled ? (
          <ShieldCheck className="h-4.5 w-4.5" />
        ) : (
          <ShieldOff className="h-4.5 w-4.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-semibold text-brand-ink">
          Two-factor authentication
        </h3>
        <p className="mt-0.5 text-xs text-brand-mute">
          {enabled
            ? "On — a code from your authenticator app is required at sign-in."
            : "Off — add a second step at sign-in. Recommended."}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute transition group-hover:translate-x-0.5 group-hover:text-brand-primary" />
    </Link>
  );
}
