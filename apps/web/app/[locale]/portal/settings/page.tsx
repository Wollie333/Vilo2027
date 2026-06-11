import { createServerClient } from "@/lib/supabase/server";

import { SettingsForms } from "./SettingsForms";

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
    />
  );
}
