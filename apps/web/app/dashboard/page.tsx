import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { SignOutButton } from "./SignOutButton";

export const metadata: Metadata = {
  title: "Dashboard · Vilo",
};

export default async function DashboardPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
          <span className="inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-xs font-medium text-brand-primary">
            <span className="h-1.5 w-1.5 rounded-pill bg-brand-primary" />
            Signed in
          </span>

          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-brand-ink">
            Welcome to Vilo
          </h1>
          <p className="mt-2 text-brand-mute">
            You&rsquo;re signed in as{" "}
            <span className="font-medium text-brand-ink">{user.email}</span>.
            The full host dashboard lands later in Phase 1.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
