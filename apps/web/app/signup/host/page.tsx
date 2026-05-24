import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { Wizard } from "./Wizard";

export const metadata: Metadata = {
  title: "Become a host · Vilo",
  description:
    "Set up your Vilo host profile and your first listing — five quick steps.",
};

export const dynamic = "force-dynamic";

export default async function HostSignupPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If they're already a host, send them home — no point re-onboarding.
  if (user) {
    const { data: existingHost } = await supabase
      .from("hosts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingHost) {
      redirect("/dashboard");
    }
  }

  // Unsigned users can land here directly — Step 1 (Account) creates the
  // auth user. If a signed-in user (no host row yet) comes back to finish,
  // we just skip Step 1 client-side using the prefilledEmail prop.
  return <Wizard prefilledEmail={user?.email ?? null} />;
}
