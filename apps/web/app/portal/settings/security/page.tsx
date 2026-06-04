import type { Metadata } from "next";

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

  return <SecurityForm email={user.email ?? ""} />;
}
