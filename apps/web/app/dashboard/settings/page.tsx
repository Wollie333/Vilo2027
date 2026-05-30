import type { Metadata } from "next";
import { UserRound } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { HostProfileForm } from "@/components/host/HostProfileForm";

import { PasswordCard } from "./PasswordCard";

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
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          Profile
        </h2>
        <p className="mt-1 text-sm text-brand-mute">
          Your public host identity and how you sign in.
        </p>
      </div>

      {/* Card chrome matches the Banking & business tab (icon tile + divider).
          HostProfileForm is shared with the setup wizard, so the card wrapper
          lives here at the page level — not inside the form component. */}
      <div className="rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center gap-2.5 border-b border-brand-line px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
            <UserRound className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Your profile
            </h3>
            <p className="mt-0.5 text-xs text-brand-mute">
              Shown on your public host page.
            </p>
          </div>
        </div>
        <div className="px-5 py-5">
          <HostProfileForm
            emailVerified={Boolean(user?.email_confirmed_at)}
            defaults={{
              full_name: profile?.full_name ?? "",
              email: profile?.email || user?.email || "",
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
        </div>
      </div>

      <PasswordCard />
    </div>
  );
}
