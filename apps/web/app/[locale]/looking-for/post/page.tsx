import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import {
  BLANK_REQUEST,
  RequestForm,
} from "@/app/[locale]/portal/looking-for/_components/RequestForm";
import { getLookingForRequirements } from "@/lib/looking-for/requirements";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post a request — tell hosts what you're looking for | Wielo",
  description:
    "Describe your ideal stay — where, when, how many guests and your budget — and South African hosts send you direct, commission-free quotes. Free to post, no account needed to start.",
  openGraph: {
    title: "Post a request on Wielo",
    description:
      "Tell hosts what you're looking for and get direct, commission-free quotes.",
    type: "website",
    siteName: "Wielo",
  },
};

// PUBLIC post-first funnel (WS-2a). A signed-out visitor completes the wizard
// with no account; the submit endpoint mints a passwordless identity and signs
// them in. A visitor who IS signed in belongs on the authed portal flow.
export default async function PublicPostRequestPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/portal/looking-for/new");
  }

  const requirementGroups = await getLookingForRequirements();

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Looking For
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl">
              Tell hosts what you&apos;re looking for
            </h1>
            <p className="mt-2 leading-relaxed text-brand-mute">
              Describe your ideal stay and South African hosts send you direct,
              commission-free quotes. It&apos;s free to post — start now, and
              we&apos;ll set up your account as you go.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <RequestForm
          mode="create"
          userId={null}
          initial={BLANK_REQUEST}
          serverDraft={null}
          requirementGroups={requirementGroups}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
