import type { Metadata } from "next";

import { TwoFactorCard } from "@/components/auth/TwoFactorCard";
import { createServerClient } from "@/lib/supabase/server";

import { SecurityForm } from "../SecurityForm";

export const metadata: Metadata = {
  title: "Security · Settings",
};

export const dynamic = "force-dynamic";

export default async function PortalSecuritySettingsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <SecurityForm email={user.email ?? ""} />
      <TwoFactorCard />
    </div>
  );
}
