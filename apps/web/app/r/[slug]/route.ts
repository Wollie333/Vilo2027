import { createHash } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { REF_COOKIE } from "@/lib/affiliate/attribution";
import { createAdminClient } from "@/lib/supabase/admin";

// Affiliate referral link: /r/<slug>[?next=/some/path][?c=<campaignSlug>].
// Logs the click, drops a first-party 30-day `vilo_ref` cookie, then redirects.
// Locale-free (registered in middleware's FUNCTIONAL set). Unknown or suspended
// slugs simply redirect with no cookie.
//
// CAMPAIGN LAYER (WS-1.2): an optional `?c=<campaignSlug>` tags the referral to a
// campaign. Resolved here to the campaign id and carried in the cookie as `camp`;
// binding writes affiliate_referrals.campaign_id from it. Only an ACTIVE campaign
// (partner-eligible) tags — anything else drops `camp` and the referral stays on
// the default program (campaign_id NULL). The pretty co-branded /partners/<slug>
// route (WS-1.7) drops the same cookie later.

export const dynamic = "force-dynamic";
// A cached read here is a correctness bug: campaign eligibility (status + window)
// and the affiliate's active state must reflect the LIVE row, or a paused/ended
// competition keeps tagging referrals from the Data Cache. Force every fetch in
// this handler fresh (belt: segment config; braces: the no-store admin client).
export const fetchCache = "force-no-store";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next");
  // Same-origin internal paths only. Must start with a single "/" — reject
  // "//host" / "/\host" (protocol-relative → external redirect) and anything not
  // path-shaped, so ?next= can never bounce a visitor off-site.
  const dest =
    nextParam &&
    nextParam.startsWith("/") &&
    nextParam[1] !== "/" &&
    nextParam[1] !== "\\"
      ? nextParam
      : "/";
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const res = NextResponse.redirect(new URL(dest, base));

  const slug = params.slug?.trim();
  if (!slug) return res;

  // no-store: this handler decides live attribution — never off a cached read.
  const admin = createAdminClient({ noStore: true });

  const { data: aff } = await admin
    .from("affiliate_accounts")
    .select("id, slug, status")
    .ilike("slug", slug)
    .maybeSingle();
  // A suspended partner still CAPTURES referrals (they just earn nothing — the
  // accrual RPC returns no commission for a non-active affiliate, so 100% stays
  // with Wielo). Only closed/pending partners drop attribution entirely.
  if (!aff || (aff.status !== "active" && aff.status !== "suspended"))
    return res;

  const { data: settings } = await admin
    .from("affiliate_settings")
    .select("cookie_days, attribution_model")
    .eq("id", true)
    .maybeSingle();
  const cookieDays = settings?.cookie_days ?? 90;
  const model = settings?.attribution_model ?? "last_click";

  // Optional campaign tag. Resolve the slug to an ACTIVE, in-window campaign that
  // this partner is eligible for; otherwise leave it null (→ default program).
  // A campaign link for a CLOSED competition therefore drops the tag and behaves
  // as the partner's default link (SoT §10.2 auto-redirect-to-default).
  let campaignId: string | null = null;
  let campaignSlug: string | null = null;
  // The competition's commission structure, captured server-side so the rate is
  // fixed at click and cannot be forged via the cookie (SoT §3.2 rule 2).
  let commissionSnapshot: unknown = null;
  const campParam = url.searchParams.get("c")?.trim();
  if (campParam) {
    const { data: camp } = await admin
      .from("affiliate_campaigns")
      .select(
        "id, slug, status, starts_at, ends_at, eligible_partners, commission_structure",
      )
      .ilike("slug", campParam)
      .maybeSingle();
    if (camp && camp.status === "active") {
      const now = Date.now();
      const started = !camp.starts_at || Date.parse(camp.starts_at) <= now;
      const notEnded = !camp.ends_at || Date.parse(camp.ends_at) > now;
      let eligible = camp.eligible_partners === "all";
      if (!eligible) {
        // 'tagged'/'invite' campaigns require an active enrollment.
        const { data: enrolled } = await admin
          .from("affiliate_campaign_enrollments")
          .select("id")
          .eq("affiliate_id", aff.id)
          .eq("campaign_id", camp.id)
          .eq("status", "active")
          .maybeSingle();
        eligible = Boolean(enrolled);
      }
      if (started && notEnded && eligible) {
        campaignId = camp.id;
        campaignSlug = camp.slug;
        commissionSnapshot = camp.commission_structure ?? null;
      }
    }
  }

  // First-click attribution: keep an existing, still-valid cookie.
  if (model === "first_click") {
    try {
      const existing = req.cookies.get(REF_COOKIE)?.value;
      if (existing) {
        const parsed = JSON.parse(existing) as { aff?: string; ts?: number };
        if (
          parsed?.aff &&
          parsed?.ts &&
          Date.now() - parsed.ts < cookieDays * 86_400_000
        ) {
          return res;
        }
      }
    } catch {
      // fall through and set a fresh cookie
    }
  }

  // Best-effort click log. A hashed visitor fingerprint, never a raw IP.
  let clickId: string | null = null;
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "";
    const ua = req.headers.get("user-agent") ?? "";
    const visitorHash = ip
      ? createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32)
      : null;
    const { data: click, error: clickErr } = await admin
      .from("affiliate_clicks")
      .insert({
        affiliate_id: aff.id,
        slug: aff.slug,
        visitor_hash: visitorHash,
        landing_path: dest,
        referer: req.headers.get("referer"),
        user_agent: ua || null,
        // Campaign the link was tagged to (WS-1m), so the campaign funnel can
        // measure clicks — null when the visit is on the default programme.
        campaign_id: campaignId,
        // Rate captured at click (server-trusted). bind copies this onto the
        // referral so the rate is fixed at click and survives campaign end.
        commission_snapshot: commissionSnapshot,
      })
      .select("id")
      .maybeSingle();
    // Never block the redirect, but make failures VISIBLE: a swallowed insert
    // error (schema/RLS drift) is exactly how clicks silently drop to 0 while
    // signups keep flowing, which is undiagnosable without a log.
    if (clickErr) {
      console.error("[affiliate/click] failed to log click", clickErr);
    }
    clickId = click?.id ?? null;
  } catch (err) {
    console.error("[affiliate/click] click log threw", err);
  }

  res.cookies.set(
    REF_COOKIE,
    JSON.stringify({
      aff: aff.id,
      slug: aff.slug,
      ts: Date.now(),
      click: clickId,
      ...(campaignId ? { camp: campaignId, campSlug: campaignSlug } : {}),
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieDays * 86_400,
    },
  );
  return res;
}
