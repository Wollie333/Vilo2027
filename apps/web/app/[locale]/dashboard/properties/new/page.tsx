import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
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
  const hostId = await getMyHostId(supabase);
  if (!hostId) {
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

  return <NewListingForm categoryLeaves={categoryLeaves} />;
}
