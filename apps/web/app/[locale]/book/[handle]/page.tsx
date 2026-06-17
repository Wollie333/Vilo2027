import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, BedDouble, MapPin } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Book direct",
};

// A host's permanent, shareable DIRECT-BOOKING link: vilo.../book/{handle}.
// It drops the guest straight into checkout, skipping the listing detail page.
//  • one published listing  → redirect to /property/{slug}/book
//  • several                → a tiny "pick where to stay" page, each going to /book
//  • none                   → a friendly "not taking bookings yet" message
// Public + anonymous (the /book page itself allows guest checkout without login).
export const dynamic = "force-dynamic";

type LiveListing = {
  slug: string;
  name: string;
  city: string | null;
  province: string | null;
  base_price: number | string | null;
  currency: string | null;
  photos: { url: string | null; sort_order: number }[] | null;
};

function coverOf(l: LiveListing): string | null {
  return (
    (l.photos ?? [])
      .filter((p) => p.url)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null
  );
}

export default async function DirectBookingPage({
  params,
}: {
  params: { handle: string };
}) {
  const admin = createAdminClient();

  const { data: host } = await admin
    .from("hosts")
    .select("id, display_name, handle")
    .eq("handle", params.handle)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) notFound();

  const { data: rows } = await admin
    .from("properties")
    .select(
      "slug, name, city, province, base_price, currency, is_featured, photos:property_photos ( url, sort_order )",
    )
    .eq("host_id", host.id)
    .eq("is_published", true)
    .eq("property_type", "accommodation")
    .is("deleted_at", null)
    .neq("is_suspended", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  const live = (rows ?? []) as LiveListing[];

  // Straight to checkout when there's a single place — the whole point of the link.
  if (live.length === 1) {
    redirect(`/property/${live[0].slug}/book`);
  }

  if (live.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfbfb] px-4 py-16">
        <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-8 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
            <BedDouble className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-brand-ink">
            {host.display_name} isn&rsquo;t taking direct bookings yet
          </h1>
          <p className="mt-1.5 text-sm text-brand-mute">
            There are no places available to book right now. Check back soon.
          </p>
        </div>
      </main>
    );
  }

  // Several places → a tiny picker, each card jumping straight into checkout.
  return (
    <main className="min-h-screen bg-[#fbfbfb] px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
          Book direct
        </div>
        <h1 className="mt-1 font-display text-[26px] font-bold tracking-tight text-brand-ink sm:text-[30px]">
          Book direct with {host.display_name}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-brand-mute">
          Pick where you&rsquo;d like to stay — you&rsquo;ll go straight to
          checkout, no browsing required.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {live.map((l) => {
            const cover = coverOf(l);
            const location = [l.city, l.province].filter(Boolean).join(", ");
            return (
              <Link
                key={l.slug}
                href={`/property/${l.slug}/book`}
                className="group overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition hover:shadow-lift"
              >
                <div className="relative aspect-[16/10] bg-brand-accent/40">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={l.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-brand-primary">
                      <BedDouble className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="truncate font-display text-[15px] font-bold text-brand-ink">
                    {l.name}
                  </div>
                  {location ? (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-brand-mute">
                      <MapPin className="h-3.5 w-3.5 text-brand-primary" />
                      {location}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-end justify-between border-t border-brand-line pt-3">
                    <div>
                      {l.base_price != null ? (
                        <>
                          <span className="font-display text-[16px] font-bold text-brand-ink">
                            {formatMoney(
                              Number(l.base_price),
                              l.currency ?? "ZAR",
                            )}
                          </span>
                          <span className="text-[11px] text-brand-mute">
                            {" "}
                            / night
                          </span>
                        </>
                      ) : (
                        <span className="text-[12px] text-brand-mute">
                          Tap to see rates
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-primary group-hover:underline">
                      Book <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
