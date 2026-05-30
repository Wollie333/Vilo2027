"use client";

import { UserRound } from "lucide-react";
import { useState } from "react";

import { HostProfileForm } from "@/components/host/HostProfileForm";

import { SavedCard } from "../_atoms";
import type { Host, Profile } from "../types";

type Props = {
  host: Host;
  profile: Profile;
  emailVerified: boolean;
  onSaved: (next: { host: Partial<Host>; profile: Partial<Profile> }) => void;
};

// Thin wrapper around the shared HostProfileForm (single source of truth,
// also used on /dashboard/settings). Collapses to a summary card with Edit once
// the profile is complete; the form's "Save & continue" advances the wizard.
export function StepProfile({ host, profile, emailVerified, onSaved }: Props) {
  const complete = Boolean(
    host.bio && host.avatar_url && (host.languages_spoken?.length ?? 0) > 0,
  );
  const [editing, setEditing] = useState(!complete);

  if (!editing) {
    return (
      <SavedCard
        icon={<UserRound className="h-4 w-4" />}
        title="Host profile"
        rows={[
          { label: "Name", value: profile.full_name },
          { label: "Phone", value: profile.phone },
          {
            label: "Languages",
            value: (host.languages_spoken ?? []).join(", "),
          },
        ]}
        onEdit={() => setEditing(true)}
      />
    );
  }

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
      onSaved={(v) => {
        onSaved({
          host: {
            display_name: v.display_name || host.display_name,
            bio: v.bio ?? "",
            avatar_url: v.avatar_url ?? "",
            website_url: v.website_url ?? "",
            languages_spoken: v.languages_spoken ?? [],
          },
          profile: { full_name: v.full_name, phone: v.phone ?? "" },
        });
        setEditing(false);
      }}
    />
  );
}
