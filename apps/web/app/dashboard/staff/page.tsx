import type { Metadata } from "next";
import { Users } from "lucide-react";

import { ComingSoon } from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Staff · Vilo",
};

export default function StaffPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Staff & co-hosts"
      tagline="Add cleaners, co-hosts and assistants with scoped permissions."
      phase="Phase 3"
      bullets={[
        "Email invites with role-scoped tokens",
        "Roles: co-host, cleaner, assistant — granular permissions",
        "3 seats on Pro · unlimited on Business",
        "Activity log + audit trail per action",
      ]}
    />
  );
}
