import type { Metadata } from "next";
import Link from "next/link";

import { DeleteAccountSection } from "@/app/[locale]/dashboard/settings/data/DeleteAccountSection";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Data & privacy · Settings",
};

export const dynamic = "force-dynamic";

export default async function PortalDataSettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section>
        <p className="text-sm text-brand-mute">
          Sign in to manage your data.{" "}
          <Link
            href="/login"
            className="text-brand-primary underline-offset-2 hover:underline"
          >
            Log in →
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          Data &amp; privacy
        </h2>
        <p className="mt-1 text-sm text-brand-mute">
          Manage your privacy rights. We comply with POPIA and GDPR and respond
          to every request within 30 days.
        </p>
      </header>

      <DeleteAccountSection email={user.email ?? ""} />

      <p className="text-[12px] text-brand-mute">
        Need a data export, or have a privacy question? Email{" "}
        <a
          href="mailto:privacy@viloplatform.com"
          className="text-brand-primary underline-offset-2 hover:underline"
        >
          privacy@viloplatform.com
        </a>{" "}
        and we&rsquo;ll respond within 30 days.
      </p>
    </section>
  );
}
