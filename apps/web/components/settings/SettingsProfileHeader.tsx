import { BadgeCheck, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getPlan } from "@/lib/plans/getPlans";
import { createServerClient } from "@/lib/supabase/server";

// White profile header + stat band shown above every Settings tab (matches the
// Settings design). Server component — pulls the host's real identity, plan,
// listing count and response rate.
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
}

export async function SettingsProfileHeader() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: host }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("hosts")
      .select(
        "id, display_name, handle, avatar_url, is_superhost, is_verified, response_rate, created_at",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const [{ data: sub }, { count: listingCount }] = await Promise.all([
    host
      ? supabase
          .from("subscriptions")
          .select("plan")
          .eq("host_id", host.id)
          .maybeSingle()
      : Promise.resolve({ data: null as { plan: string } | null }),
    host
      ? supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("host_id", host.id)
          .is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
  ]);

  const name = host?.display_name || profile?.full_name || "Your account";
  const email = profile?.email || user.email || "";
  const avatarUrl = profile?.avatar_url || host?.avatar_url || "";
  const planName = (await getPlan(sub?.plan ?? "free"))?.name ?? "Free";
  const memberSince = host?.created_at
    ? new Date(host.created_at).getFullYear()
    : new Date(user.created_at).getFullYear();
  const responseRate =
    host?.response_rate != null ? `${Math.round(host.response_rate)}%` : "—";

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-[68px] w-[68px] rounded-full object-cover ring-2 ring-brand-accent"
            />
          ) : (
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand-secondary font-display text-[22px] font-bold text-white">
              {initials(name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[22px] font-extrabold leading-tight text-brand-ink">
              {name}
            </h2>
            {host?.is_superhost ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" /> Superhost
              </span>
            ) : host?.is_verified ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </span>
            ) : null}
          </div>
          {email ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-brand-mute">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {email}
              </span>
            </div>
          ) : null}
        </div>
        {host?.handle ? (
          <Link
            href={`/${host.handle}`}
            target="_blank"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <ExternalLink className="h-4 w-4 text-brand-mute" /> View public
            profile
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-brand-line bg-brand-line sm:grid-cols-4">
        <Stat label="Member since" value={String(memberSince)} />
        <Stat label="Plan" value={planName} />
        <Stat label="Listings" value={String(listingCount ?? 0)} />
        <Stat label="Response rate" value={responseRate} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#FAFCFB] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="mt-1 font-display text-[18px] font-bold leading-none text-brand-ink">
        {value}
      </div>
    </div>
  );
}
