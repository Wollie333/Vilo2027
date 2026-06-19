import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Sparkles, Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { canUseSpecials } from "@/lib/specials/gate";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";

import { SpecialsList, type SpecialRow } from "./SpecialsList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("specials");
  return { title: t("metaTitle") };
}

export const dynamic = "force-dynamic";

export default async function SpecialsPage() {
  const t = await getTranslations("specials");
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
          {t("noHostTitle")}
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          {t("noHostBody")}
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
          {t("lockedTitle")}
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          {t("lockedBody")}
        </p>
      </div>
    );
  }

  // Scope to the owner — specials carries a public read policy for active deals,
  // so the explicit host_id filter is what keeps drafts private.
  const { data: rows } = await supabase
    .from("specials")
    .select(
      "id, slug, title, description, status, quantity, redemptions_used, is_featured, sort_order, price_mode, flat_total, per_night_price, currency, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, go_live_at, book_by, savings_pct, show_in_directory, show_on_website, hero_image_path, property:properties ( name )",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);

  // Derive the display bucket: an `active` special is either live now or
  // scheduled for later (go_live in the future); everything else maps to its
  // own status. Stats + filter chips both key off this so they always agree.
  function bucketOf(r: {
    status: string;
    go_live_at: string | null;
  }): SpecialRow["bucket"] {
    if (r.status === "active") {
      return r.go_live_at && r.go_live_at > today ? "scheduled" : "live";
    }
    return r.status as SpecialRow["bucket"];
  }

  const specials: SpecialRow[] = (rows ?? []).map((r) => {
    const prop = (Array.isArray(r.property) ? r.property[0] : r.property) as {
      name: string;
    } | null;
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      status: r.status as SpecialRow["status"],
      bucket: bucketOf(r),
      quantity: r.quantity,
      redemptionsUsed: r.redemptions_used,
      isFeatured: r.is_featured,
      priceMode: r.price_mode as SpecialRow["priceMode"],
      flatTotal: r.flat_total == null ? null : Number(r.flat_total),
      perNightPrice:
        r.per_night_price == null ? null : Number(r.per_night_price),
      currency: r.currency,
      savingsPct: r.savings_pct,
      dateMode: r.date_mode as SpecialRow["dateMode"],
      fixedCheckIn: r.fixed_check_in,
      fixedCheckOut: r.fixed_check_out,
      windowStart: r.window_start,
      windowEnd: r.window_end,
      bookBy: r.book_by,
      heroUrl: websiteAssetUrl(r.hero_image_path),
      showInDirectory: r.show_in_directory,
      showOnWebsite: r.show_on_website,
      propertyName: prop?.name ?? t("propertyRemoved"),
    };
  });

  const stats = {
    live: specials.filter((s) => s.bucket === "live").length,
    scheduled: specials.filter((s) => s.bucket === "scheduled").length,
    drafts: specials.filter((s) => s.bucket === "draft").length,
  };
  const topDeal = specials
    .filter((s) => s.bucket === "live" && s.savingsPct != null)
    .sort((a, b) => (b.savingsPct ?? 0) - (a.savingsPct ?? 0))[0];

  return (
    <div className="space-y-6">
      <SpecialsHeader />
      <StatBand
        stats={stats}
        topDeal={
          topDeal
            ? { pct: topDeal.savingsPct as number, title: topDeal.title }
            : null
        }
      />
      <SpecialsList specials={specials} />
    </div>
  );
}

async function SpecialsHeader() {
  const [t, brandName] = await Promise.all([
    getTranslations("specials"),
    getBrandName(),
  ]);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
          <span>{t("mgrCrumb")}</span>
        </nav>
        <h1 className="mt-1 flex items-center gap-2 font-display text-[22px] font-extrabold leading-none text-brand-ink">
          <Sparkles className="h-5 w-5 text-brand-primary" />
          {t("mgrTitle")}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-brand-mute">
          {t("mgrIntro", { brand: brandName })}
        </p>
      </div>
      <Link
        href="/dashboard/specials/new"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition-colors hover:bg-brand-secondary"
      >
        <Plus className="h-4 w-4" />
        {t("newCta")}
      </Link>
    </div>
  );
}

async function StatBand({
  stats,
  topDeal,
}: {
  stats: { live: number; scheduled: number; drafts: number };
  topDeal: { pct: number; title: string } | null;
}) {
  const t = await getTranslations("specials");
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-brand-line bg-brand-line sm:grid-cols-4">
      <StatTile
        label={t("statLive")}
        value={String(stats.live)}
        sub={t("statLiveSub")}
        subClass="text-green-600"
      />
      <StatTile
        label={t("statScheduled")}
        value={String(stats.scheduled)}
        sub={t("statScheduledSub")}
      />
      <StatTile
        label={t("statDrafts")}
        value={String(stats.drafts)}
        sub={t("statDraftsSub")}
      />
      <div
        className="p-4"
        style={{
          backgroundImage: "linear-gradient(145deg, #064E3B 0%, #052E1F 100%)",
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {t("statTopDeal")}
        </div>
        <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-white">
          {topDeal ? t("statTopDealOff", { pct: topDeal.pct }) : "—"}
        </div>
        <div className="mt-1 truncate text-[11px] text-brand-accent">
          {topDeal ? topDeal.title : t("statTopDealNone")}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  subClass,
}: {
  label: string;
  value: string;
  sub: string;
  subClass?: string;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-brand-mute">
        {label}
      </div>
      <div className="mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div className={`mt-1 text-[11px] ${subClass ?? "text-brand-mute"}`}>
        {sub}
      </div>
    </div>
  );
}
