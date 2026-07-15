import { Coins } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCreditBalance } from "@/lib/credits/wallet";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Top up credits" };

// Host credit-package store — the internal top-up. Lists the active
// wielo_credits products; buying one runs the normal product purchase flow
// (/p/[slug]) which, on payment, grants the credits to the host's wallet.
export default async function CreditsTopUpPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/credits");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) redirect("/dashboard");

  const balance = await getCreditBalance(supabase, host.id, "quote");

  // Credit packages (once-off) + credit-bearing memberships (recurring) come from
  // the shared catalog (admin manages them in Products). Both buy through the
  // public product page /p/[slug], which grants credits on payment.
  const admin = createAdminClient();
  const [{ data: packages }, { data: memberships }] = await Promise.all([
    admin
      .from("products")
      .select("id, name, description, price, currency, credit_quantity, slug")
      .eq("product_type", "wielo_credits")
      .eq("is_active", true)
      .order("price", { ascending: true }),
    admin
      .from("products")
      .select("id, name, description, price, currency, credit_quantity, slug")
      .eq("product_type", "membership")
      .eq("is_active", true)
      .eq("is_visible", true)
      .gt("credit_quantity", 0)
      .order("price", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Coins className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-brand-ink">
            Top up credits
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Credits are used when you send a quote. You currently have{" "}
            <span className="font-semibold text-brand-ink">
              {balance} credit{balance === 1 ? "" : "s"}
            </span>
            .
          </p>
        </div>
      </div>

      {memberships && memberships.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Monthly membership
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {memberships.map((m) => (
              <div
                key={m.id}
                className="flex flex-col rounded-card border border-brand-primary/30 bg-brand-primary/5 p-5"
              >
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-brand-primary" />
                  <h3 className="font-display text-base font-bold text-brand-ink">
                    {m.name}
                  </h3>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums text-brand-ink">
                  {m.credit_quantity ?? 0}
                  <span className="ml-1 text-sm font-medium text-brand-mute">
                    credits / month
                  </span>
                </p>
                {m.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-brand-mute">
                    {m.description}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold text-brand-ink">
                    {formatMoney(Number(m.price ?? 0), m.currency ?? "ZAR")}
                    <span className="text-sm font-normal text-brand-mute">
                      {" "}
                      / month
                    </span>
                  </span>
                  <Button asChild size="sm">
                    <Link href={m.slug ? `/p/${m.slug}` : "/dashboard/credits"}>
                      Subscribe
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        Once-off packs
      </h2>
      {!packages || packages.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No credit packages yet
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            Credit packages will appear here once they&apos;re available.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-card border border-brand-line bg-white p-5"
            >
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-brand-primary" />
                <h3 className="font-display text-base font-bold text-brand-ink">
                  {p.name}
                </h3>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-brand-ink">
                {p.credit_quantity ?? 0}
                <span className="ml-1 text-sm font-medium text-brand-mute">
                  credits
                </span>
              </p>
              {p.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-brand-mute">
                  {p.description}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-lg font-semibold text-brand-ink">
                  {formatMoney(Number(p.price ?? 0), p.currency ?? "ZAR")}
                </span>
                <Button asChild size="sm">
                  <Link href={p.slug ? `/p/${p.slug}` : "/dashboard/credits"}>
                    Buy
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
