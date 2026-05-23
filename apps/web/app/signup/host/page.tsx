import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { Wizard } from "./Wizard";

export const metadata: Metadata = {
  title: "Become a host · Vilo",
  description:
    "Set up your Vilo host profile and your first listing — five quick steps.",
};

export default async function HostSignupPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth-only. Middleware will catch this too but be explicit.
  if (!user) {
    redirect("/login?next=/signup/host");
  }

  // If they already have a hosts row, the wizard's done — send them home.
  const { data: existingHost } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingHost) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      <Wizard userEmail={user.email ?? ""} />
    </main>
  );
}
