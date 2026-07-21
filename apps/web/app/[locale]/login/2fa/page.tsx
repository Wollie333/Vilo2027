import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { hasVerifiedFactor } from "@/lib/auth/mfa";
import { getBrandName } from "@/lib/brand";
import { createServerClient } from "@/lib/supabase/server";

import { MfaChallengeForm } from "./MfaChallengeForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Two-factor · ${await getBrandName()}` };
}

// The second step of signing in. Reached from middleware whenever the session is
// only AAL1 but the account has a verified factor — after a password sign-in OR
// a magic link, because an attacker with the inbox is exactly who this stops.
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Nothing to challenge → don't strand them on a dead page.
  if (!(await hasVerifiedFactor(user.id))) redirect(searchParams.next || "/");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factorId = factors?.totp?.[0]?.id ?? "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col justify-center px-5 py-12">
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-brand-ink">
        Enter your code
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-mute">
        Open your authenticator app and enter the 6-digit code for{" "}
        <span className="font-medium text-brand-ink">{user.email}</span>.
      </p>
      <div className="mt-7">
        <MfaChallengeForm factorId={factorId} next={searchParams.next ?? "/"} />
      </div>
    </main>
  );
}
