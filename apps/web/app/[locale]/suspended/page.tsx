import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";

import { signOutAction } from "../(auth)/actions";

// The wall a SUSPENDED account hits. Reached only via the dashboard/portal layout
// redirect when user_profiles.is_active = false. Lives OUTSIDE those layouts so it
// never loops. Server actions are blocked independently in requireHost — this page
// is just the human-facing notice. A still-active user who lands here (e.g. a stale
// link after reinstatement) is bounced back to their app.
export default async function SuspendedPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();

  // Not actually suspended (anymore) → don't strand them on this page.
  if (profile?.is_active !== false) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-light px-4">
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-cancelled/10 text-status-cancelled">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-brand-ink">
          Your account is suspended
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Access to your dashboard, listings and features is paused. Your data
          is safe and nothing has been deleted. Please contact support to have
          your account reviewed and reinstated.
        </p>
        <a
          href="mailto:support@wielo.co.za"
          className="mt-4 inline-block text-sm font-semibold text-brand-ink underline"
        >
          support@wielo.co.za
        </a>
        <form action={signOutAction} className="mt-6">
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
