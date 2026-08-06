import type { Metadata } from "next";
import { ChevronRight, Gauge } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { loadListingStrength } from "@/lib/search/loadListingStrength";
import { createServerClient } from "@/lib/supabase/server";

import { ListingStrengthCard } from "../../ListingStrengthCard";

export const metadata: Metadata = {
  title: "Listing strength",
};

export const dynamic = "force-dynamic";

export default async function ListingStrengthPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/dashboard/properties/${params.id}/strength`);
  }

  // Own-only: loadListingStrength proves ownership via RLS before reading.
  const result = await loadListingStrength(params.id);
  if (!result) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <nav className="flex items-center gap-1.5 text-[12px] text-brand-mute">
          <Link href="/dashboard/properties" className="hover:text-brand-ink">
            Properties
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={`/dashboard/properties/${params.id}/edit`}
            className="max-w-[220px] truncate hover:text-brand-ink"
          >
            {result.listingName}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-brand-ink">Listing strength</span>
        </nav>

        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-[24px] font-extrabold leading-tight text-brand-ink">
              Listing strength
            </h1>
            <p className="text-[13.5px] text-brand-mute">
              How <span className="font-medium">{result.listingName}</span>{" "}
              ranks in the Wielo directory, and the quick wins to climb.
            </p>
          </div>
        </div>
      </header>

      <ListingStrengthCard strength={result.strength} listingId={params.id} />
    </div>
  );
}
