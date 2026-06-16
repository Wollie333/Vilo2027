import { createHash } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { REF_COOKIE } from "@/lib/affiliate/attribution";
import { createAdminClient } from "@/lib/supabase/admin";

// Affiliate referral link: /r/<slug>[?next=/some/path].
// Logs the click, drops a first-party 30-day `vilo_ref` cookie, then redirects.
// Locale-free (registered in middleware's FUNCTIONAL set). Unknown or suspended
// slugs simply redirect with no cookie.

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next");
  const dest = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const res = NextResponse.redirect(new URL(dest, base));

  const slug = params.slug?.trim();
  if (!slug) return res;

  const admin = createAdminClient();

  const { data: aff } = await admin
    .from("affiliate_accounts")
    .select("id, slug, status")
    .ilike("slug", slug)
    .maybeSingle();
  if (!aff || aff.status !== "active") return res;

  const { data: settings } = await admin
    .from("affiliate_settings")
    .select("cookie_days, attribution_model")
    .eq("id", true)
    .maybeSingle();
  const cookieDays = settings?.cookie_days ?? 30;
  const model = settings?.attribution_model ?? "last_click";

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
    const { data: click } = await admin
      .from("affiliate_clicks")
      .insert({
        affiliate_id: aff.id,
        slug: aff.slug,
        visitor_hash: visitorHash,
        landing_path: dest,
        referer: req.headers.get("referer"),
        user_agent: ua || null,
      })
      .select("id")
      .maybeSingle();
    clickId = click?.id ?? null;
  } catch {
    // Logging failures must not block the redirect.
  }

  res.cookies.set(
    REF_COOKIE,
    JSON.stringify({
      aff: aff.id,
      slug: aff.slug,
      ts: Date.now(),
      click: clickId,
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
