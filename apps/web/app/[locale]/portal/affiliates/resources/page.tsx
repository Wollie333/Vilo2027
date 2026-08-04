import type { Metadata } from "next";
import { Gift } from "lucide-react";

import { getAffiliateForUser } from "@/lib/affiliate/account";
import { displayLink, funnelResourceLink } from "@/lib/affiliate/links";
import { listShareableFunnels } from "@/lib/affiliate/resources";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { CopyLinkButton } from "../_components/CopyLinkButton";

export const metadata: Metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

// Ready-made pipeline capture pages, each wrapped in this partner's attributed
// /r/<slug> link (no competition tag — the default programme). Same list the
// competition Resources tab shows; a submitted capture binds the referral to the
// lead's account at capture time, so attribution survives a later signup.
export default async function AffiliateResourcesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://wielo.co.za";

  const funnels = await listShareableFunnels();
  const items = funnels.map((f) => {
    const url = funnelResourceLink(appUrl, account.slug, f.slug);
    return { ...f, url, urlShort: displayLink(url) };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[19px] font-bold text-brand-ink">
          Resources
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-brand-mute">
          Ready-made pages that capture a host&rsquo;s details for you. Share
          any link below — anyone who signs up through it is tied to you for
          life, even if they finish signing up later on another device. Running
          a competition? Use the link from that campaign&rsquo;s Resources tab
          so the referral counts toward the race too.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="am-card p-5 text-[12.5px] text-brand-mute">
          No shareable capture pages are live yet — check back soon.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <section key={r.slug} className="am-card overflow-hidden">
              <div className="flex items-start gap-3 border-b border-brand-line px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-brand-primary">
                  <Gift className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {r.name}
                  </div>
                  {r.headline ? (
                    <div className="mt-0.5 text-[12px] leading-snug text-brand-mute">
                      {r.headline}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="p-5">
                <div className="copyfield">
                  <Gift className="h-4 w-4 shrink-0 text-brand-mute" />
                  <span className="mono flex-1 truncate text-[12.5px] text-brand-ink">
                    {r.urlShort}
                  </span>
                  <CopyLinkButton value={r.url} />
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
