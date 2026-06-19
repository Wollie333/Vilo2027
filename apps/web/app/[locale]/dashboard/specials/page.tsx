import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Sparkles, Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { canUseSpecials } from "@/lib/specials/gate";
import { createServerClient } from "@/lib/supabase/server";

import { SpecialsList, type SpecialRow } from "./SpecialsList";

export const metadata: Metadata = { title: "Specials" };

export const dynamic = "force-dynamic";

export default async function SpecialsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/specials");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-bold text-brand-ink">
          Create your host profile first
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          Finish host onboarding before creating specials.
        </p>
      </div>
    );
  }

  // UI-layer feature gate (AGENT_RULES §3.2 — gate at both action + UI layers).
  // Pre-MVP this is always open (§3.4); at launch it locks out unentitled plans.
  if (!(await canUseSpecials(host.id))) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-bold text-brand-ink">
          Specials aren’t on your plan yet
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          Upgrade your plan to create pre-packaged deals for your properties.
        </p>
      </div>
    );
  }

  // Scope to the owner — specials carries a public read policy for active deals,
  // so the explicit host_id filter is what keeps drafts private.
  const { data: rows } = await supabase
    .from("specials")
    .select(
      "id, slug, title, status, quantity, redemptions_used, is_featured, sort_order, price_mode, flat_total, per_night_price, currency, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, show_in_directory, show_on_website, hero_image_path, property:properties ( name )",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const specials: SpecialRow[] = (rows ?? []).map((r) => {
    const prop = (Array.isArray(r.property) ? r.property[0] : r.property) as {
      name: string;
    } | null;
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status as SpecialRow["status"],
      quantity: r.quantity,
      redemptionsUsed: r.redemptions_used,
      isFeatured: r.is_featured,
      priceMode: r.price_mode as SpecialRow["priceMode"],
      flatTotal: r.flat_total == null ? null : Number(r.flat_total),
      perNightPrice:
        r.per_night_price == null ? null : Number(r.per_night_price),
      currency: r.currency,
      dateMode: r.date_mode as SpecialRow["dateMode"],
      fixedCheckIn: r.fixed_check_in,
      fixedCheckOut: r.fixed_check_out,
      windowStart: r.window_start,
      windowEnd: r.window_end,
      showInDirectory: r.show_in_directory,
      showOnWebsite: r.show_on_website,
      propertyName: prop?.name ?? "Property removed",
    };
  });

  return (
    <div className="space-y-6">
      <SpecialsHero count={specials.length} />
      <SpecialsList specials={specials} />
    </div>
  );
}

function SpecialsHero({ count }: { count: number }) {
  return (
    <section
      className="relative overflow-hidden rounded-card border border-brand-line p-7 text-white shadow-card md:p-8"
      style={{
        backgroundImage:
          "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-primary/30 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Specials
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
            Pre-packaged deals
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-brand-accent/80">
            Bundle a stay, date treatment and a price you fully control.
            Specials book and settle exactly like a normal booking — they just
            override your seasonal pricing.
          </p>
        </div>
        <Link
          href="/dashboard/specials/new"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-accent"
        >
          <Plus className="h-4 w-4" />
          New special
        </Link>
      </div>
      {count > 0 ? (
        <div className="relative mt-5 text-[12.5px] font-medium text-brand-accent/70">
          {count} {count === 1 ? "special" : "specials"}
        </div>
      ) : null}
    </section>
  );
}
