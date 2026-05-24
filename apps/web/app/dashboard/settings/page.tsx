import type { Metadata } from "next";

import { createServerClient } from "@/lib/supabase/server";

import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Your profile · Settings · Vilo",
};

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, phone, email")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-brand-ink">
        Your profile
      </h2>
      <ProfileForm
        defaults={{
          full_name: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
        }}
        email={profile?.email ?? user?.email ?? ""}
      />
    </section>
  );
}
