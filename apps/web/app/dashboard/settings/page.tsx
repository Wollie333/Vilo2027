import type { Metadata } from "next";

import { createServerClient } from "@/lib/supabase/server";

import { PasswordCard } from "./PasswordCard";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Profile · Settings · Vilo",
};

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: host }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name, phone, email, avatar_url")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("hosts")
      .select(
        "display_name, handle, bio, website_url, is_verified, avatar_url, languages_spoken",
      )
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  const avatarUrl = profile?.avatar_url ?? host?.avatar_url ?? "";

  return (
    <section className="space-y-5">
      <h2 className="font-display text-lg font-bold text-brand-ink">Profile</h2>
      <ProfileForm
        defaults={{
          full_name: profile?.full_name ?? "",
          email: profile?.email ?? user?.email ?? "",
          phone: profile?.phone ?? "",
          avatar_url: avatarUrl,
          display_name: host?.display_name ?? "",
          bio: host?.bio ?? "",
          website_url: host?.website_url ?? "",
          languages_spoken: host?.languages_spoken ?? [],
        }}
        host={
          host
            ? { handle: host.handle, isVerified: host.is_verified ?? false }
            : null
        }
      />
      <PasswordCard />
    </section>
  );
}
