import { MailWarning } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";

import { signOutAction } from "../(auth)/actions";

import { VerifyEmailWall } from "./VerifyEmailWall";

// The wall an UNVERIFIED account hits. Reached only via the dashboard/portal
// layout redirect when user_profiles.email_verified_at IS NULL. Lives OUTSIDE
// those layouts so it never loops. Host server actions are blocked independently
// in requireHost/assertFullHost — this page is just the human-facing notice.
// A user who is actually verified (or platform staff) is bounced back to the app.
export default async function VerifyEmailRequiredPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("email_verified_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("platform_staff")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Already verified, or internal staff (never walled) → don't strand them.
  if (profile?.email_verified_at || staff?.is_active === true) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-light px-4">
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <MailWarning className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-brand-ink">
          Confirm your email to continue
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          We sent a confirmation link to
          {user.email ? (
            <span className="font-medium text-brand-ink"> {user.email}</span>
          ) : (
            " your inbox"
          )}
          . Click it to unlock your account — this keeps your bookings, payments
          and notifications tied to an inbox you own.
        </p>

        <VerifyEmailWall />

        <form action={signOutAction} className="mt-4">
          <Button
            type="submit"
            variant="ghost"
            className="w-full text-brand-mute"
          >
            Sign out
          </Button>
        </form>

        <p className="mt-4 text-xs text-brand-mute">
          Wrong address or need help?{" "}
          <a
            href="mailto:support@wielo.co.za"
            className="font-semibold text-brand-ink underline"
          >
            support@wielo.co.za
          </a>
        </p>
      </div>
    </main>
  );
}
