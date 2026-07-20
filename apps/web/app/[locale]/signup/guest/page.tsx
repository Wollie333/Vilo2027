import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { Wizard } from "./Wizard";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Set up your Wielo account and start booking direct stays — three quick steps.",
};

export const dynamic = "force-dynamic";

function safeNext(v: string | undefined): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default async function GuestSignupPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = safeNext(searchParams?.next);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already onboarded? Send the user to the right surface instead of
  // restarting the wizard. Host → /dashboard; staff → /admin; anyone else who
  // has a non-empty profile → /portal. A brand-new account without any
  // user_profiles row (or with only the default seed row) keeps the wizard
  // available so they can finish the about + prefs steps.
  if (user) {
    const [{ data: host }, { data: staff }, { data: profile }] =
      await Promise.all([
        supabase
          .from("hosts")
          .select("id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("platform_staff")
          .select("is_active")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_profiles")
          .select("country, bio")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

    if (host) redirect("/dashboard");
    if (staff?.is_active) redirect("/admin");
    // An already-onboarded guest with a post intent goes straight there.
    if (profile && (profile.country || profile.bio))
      redirect(next ?? "/portal");
  }

  return <Wizard prefilledEmail={user?.email ?? null} next={next} />;
}
