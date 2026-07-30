import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PreferencesForm } from "@/components/notifications/PreferencesForm";
import { getBrandName } from "@/lib/brand";
import { loadPreferencesViewModel } from "@/lib/notifications/preferences-loader";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Email preferences · ${await getBrandName()}` };
}

// One notification/email-preferences page for EVERY account type — guest, host,
// partner, staff. This is the canonical destination of the "Email preferences"
// link in every email footer (Shell.tsx), so a recipient can turn any category
// (including marketing) on or off, per channel, from one place — no matter which
// shell they normally live in. The host/partner settings pages render the same
// PreferencesForm inside their own chrome; this is the login-gated public entry.
export default async function AccountNotificationsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/notifications");

  const brandName = await getBrandName();
  const vm = await loadPreferencesViewModel();
  if (!vm) redirect("/login?next=/account/notifications");

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-10 sm:py-14">
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-brand-ink">
        Email preferences
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-mute">
        Choose which emails and alerts {brandName} sends you, and how. Booking-
        and payment-related messages are essential and always on; everything
        else — including competition updates and marketing — is yours to
        control, per channel.
      </p>
      <div className="mt-8">
        <PreferencesForm initial={vm} revalidate={["/account/notifications"]} />
      </div>
    </main>
  );
}
