import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/taxonomy/getCategories";

import { Wizard } from "./Wizard";

export const metadata: Metadata = {
  title: "Become a host",
  description:
    "Set up your Vilo host profile and your first listing — five quick steps.",
};

export const dynamic = "force-dynamic";

export default async function HostSignupPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let prefilledFullName: string | null = null;
  let prefilledPhone: string | null = null;
  let prefilledBio: string | null = null;
  let prefilledAvatar: string | null = null;
  let prefilledLanguages: string[] | null = null;
  let prefilledCountry: string | null = null;

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

    // Pre-seed any About-step fields they've already entered (full_name
    // gets set on signup or via prior wizard runs). Without this, a user
    // resuming the wizard would land on step 2 with empty fields and
    // finalize would fail Zod validation on full_name (min 2).
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, phone, bio, avatar_url, languages, country")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      prefilledFullName = (profile.full_name as string | null) ?? null;
      prefilledPhone = (profile.phone as string | null) ?? null;
      prefilledBio = (profile.bio as string | null) ?? null;
      prefilledAvatar = (profile.avatar_url as string | null) ?? null;
      prefilledLanguages = (profile.languages as string[] | null) ?? null;
      prefilledCountry = (profile.country as string | null) ?? null;
    }
  }

  // Flatten the category tree to accommodation leaves only (skip the
  // Accommodation root). MVP lists accommodation only.
  const tree = await getCategoryTree();
  const categoryLeaves = tree.accommodation.flatMap((root) =>
    root.children.map((c) => ({
      id: c.id,
      label: c.label,
      slug: c.slug,
      kind: c.kind,
      description: c.description,
    })),
  );

  // Unsigned users can land here directly — Step 1 (Account) creates the
  // auth user. If a signed-in user (no host row yet) comes back to finish,
  // we skip Step 1 and seed every About-step field we already have.
  return (
    <Wizard
      prefilledEmail={user?.email ?? null}
      prefilledFullName={prefilledFullName}
      prefilledPhone={prefilledPhone}
      prefilledBio={prefilledBio}
      prefilledAvatar={prefilledAvatar}
      prefilledLanguages={prefilledLanguages}
      prefilledCountry={prefilledCountry}
      categoryLeaves={categoryLeaves}
    />
  );
}
