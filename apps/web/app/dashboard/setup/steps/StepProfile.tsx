"use client";

import { HostProfileForm } from "@/components/host/HostProfileForm";

import type { Host, Profile } from "../types";

type Props = {
  host: Host;
  profile: Profile;
  emailVerified: boolean;
  onSaved: (next: { host: Partial<Host>; profile: Partial<Profile> }) => void;
};

// Thin wrapper around the shared HostProfileForm (single source of truth,
// also used on /dashboard/settings). Translates the saved values back into
// the wizard's host/profile state so the rail + live preview update.
export function StepProfile({ host, profile, emailVerified, onSaved }: Props) {
  return (
    <HostProfileForm
      defaults={{
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        avatar_url: host.avatar_url,
        display_name: host.display_name,
        bio: host.bio,
        website_url: host.website_url,
        languages_spoken: host.languages_spoken,
      }}
      host={{ handle: host.handle, isVerified: false }}
      emailVerified={emailVerified}
      submitLabel="Save & continue"
      onSaved={(v) =>
        onSaved({
          host: {
            display_name: v.display_name || host.display_name,
            bio: v.bio ?? "",
            avatar_url: v.avatar_url ?? "",
            website_url: v.website_url ?? "",
            languages_spoken: v.languages_spoken ?? [],
          },
          profile: { full_name: v.full_name, phone: v.phone ?? "" },
        })
      }
    />
  );
}
