import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/taxonomy/getCategories";

import { NewListingForm } from "./NewListingForm";

export const metadata: Metadata = {
  title: "New listing",
};

export default async function NewListingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/dashboard/properties/new");
  }

  // If the user hasn't finished onboarding, send them there first.
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) {
    redirect("/signup/host");
  }

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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/properties"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All listings
        </Link>
      </div>

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Add a new listing
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Just the basics — you&rsquo;ll add photos, pricing and policies in the
          editor next.
        </p>
      </header>

      <NewListingForm categoryLeaves={categoryLeaves} />
    </div>
  );
}
