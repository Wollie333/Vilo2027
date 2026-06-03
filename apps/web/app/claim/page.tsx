import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = {
  title: "Claim your account · Vilo",
};

export const dynamic = "force-dynamic";

export default async function ClaimPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Reached only via the magic link in the enquiry email, which signs the lead
  // in. No session → send them to log in.
  if (!user) redirect("/login?next=/claim");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, is_lead")
    .eq("id", user.id)
    .maybeSingle();

  const alreadyClaimed = profile ? profile.is_lead === false : false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-6 shadow-card sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-gradient text-lg font-bold text-white">
            V
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-brand-ink">
            {alreadyClaimed ? "Your account is ready" : "Claim your account"}
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            {alreadyClaimed
              ? "You've already set a password — you can sign in any time."
              : `Set a password${
                  profile?.full_name
                    ? `, ${profile.full_name.split(" ")[0]}`
                    : ""
                }, so you can sign in to track your quotes and trips.`}
          </p>
        </div>

        <div className="mt-6">
          {alreadyClaimed ? (
            <Link
              href="/portal/trips"
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
            >
              Go to my trips
            </Link>
          ) : (
            <ClaimForm />
          )}
        </div>
      </div>
    </div>
  );
}
