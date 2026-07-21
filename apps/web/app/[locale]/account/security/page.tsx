import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { countUnusedBackupCodes, hasVerifiedFactor } from "@/lib/auth/mfa";
import { currentUserHasPassword } from "@/lib/auth/reauth";
import { getBrandName } from "@/lib/brand";
import { createServerClient } from "@/lib/supabase/server";

import { MfaPanel } from "./MfaPanel";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Security · ${await getBrandName()}` };
}

// One security page for EVERY account type — guest, host, partner, staff. 2FA is
// the same thing whoever you are, so it lives in one place rather than being
// rebuilt inside each shell; the settings pages link here.
export default async function AccountSecurityPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/security");

  const [enabled, backupCodesRemaining, hasPassword] = await Promise.all([
    hasVerifiedFactor(user.id),
    countUnusedBackupCodes(user.id),
    currentUserHasPassword(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-10 sm:py-14">
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-brand-ink">
        Security
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-mute">
        Two-factor authentication adds a second step when you sign in, so
        knowing your password — or having your inbox — isn&apos;t enough on its
        own. It&apos;s optional, and we recommend it.
      </p>

      <div className="mt-8">
        <MfaPanel
          enabled={enabled}
          backupCodesRemaining={backupCodesRemaining}
          hasPassword={hasPassword}
          email={user.email ?? ""}
        />
      </div>
    </main>
  );
}
