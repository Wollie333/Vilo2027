import type { Metadata } from "next";

import { createServerClient } from "@/lib/supabase/server";

import { SettingsForms } from "./SettingsForms";

export const metadata: Metadata = {
  title: "Settings · Vilo",
};

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "full_name, phone, country, bio, avatar_url, languages, preferred_cities, marketing_opt_in",
    )
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Update your profile, contact details and travel preferences. Changes
          save instantly.
        </p>
      </header>

      <SettingsForms
        initial={{
          full_name: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
          country: profile?.country ?? "",
          bio: profile?.bio ?? "",
          avatar_url: profile?.avatar_url ?? "",
          languages: profile?.languages ?? [],
          preferred_cities: profile?.preferred_cities ?? [],
          marketing_opt_in: profile?.marketing_opt_in ?? false,
        }}
        email={user.email ?? ""}
      />
    </div>
  );
}
