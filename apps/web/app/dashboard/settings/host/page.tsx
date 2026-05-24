import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import { HostForm } from "../HostForm";

export const metadata: Metadata = {
  title: "Public host page · Settings · Vilo",
};

export const dynamic = "force-dynamic";

export default async function SettingsHostPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = await supabase
    .from("hosts")
    .select("display_name, handle, bio, website_url, is_verified")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-brand-ink">
        Public host page
      </h2>
      {host ? (
        <HostForm
          defaults={{
            display_name: host.display_name,
            bio: host.bio ?? "",
            website_url: host.website_url ?? "",
          }}
          handle={host.handle}
          isVerified={host.is_verified}
        />
      ) : (
        <Link
          href="/signup/host"
          className="flex items-start gap-4 rounded-card border border-brand-primary/40 bg-brand-accent/60 p-5 shadow-card transition-colors hover:bg-brand-accent"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-white text-brand-primary">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-brand-dark">
              Finish setting up your host profile
            </div>
            <p className="mt-0.5 text-sm text-brand-mute">
              Without a host page guests can&rsquo;t book you.
            </p>
          </div>
        </Link>
      )}
    </section>
  );
}
