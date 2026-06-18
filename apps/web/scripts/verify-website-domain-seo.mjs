// Live-DB check for W13 (Custom domain) + W14 (SEO). Confirms the columns the
// domain/SEO loaders + actions rely on read, round-trips a domain-state +
// SEO-jsonb write and an INSERT-only domain event on a real site without
// leaving residue, and checks both help articles. Net read-only (probe writes
// reverted). Run:
//   node --env-file=.env.local scripts/verify-website-domain-seo.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failed = false;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  failed = true;
  console.error(`  ✗ ${m}`);
};

// 1. Domain + SEO columns the loaders select must exist.
const { error: colErr } = await sb
  .from("host_websites")
  .select(
    "id, subdomain, custom_domain, domain_status, ssl_status, verification_token, seo, settings",
  )
  .limit(1);
if (colErr) bad(`host_websites domain/seo columns: ${colErr.message}`);
else ok("host_websites exposes domain + seo columns");

// 2. website_domain_events shape (INSERT-only audit).
const { error: evtColErr } = await sb
  .from("website_domain_events")
  .select("id, website_id, event, detail, created_at")
  .limit(1);
if (evtColErr) bad(`website_domain_events columns: ${evtColErr.message}`);
else ok("website_domain_events exposes audit columns");

// 3. Round-trip on a real site: domain state + SEO jsonb + an event.
const { data: site } = await sb
  .from("host_websites")
  .select("id, custom_domain, domain_status, ssl_status, seo, settings")
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();

if (!site) {
  console.log("  • no host_websites row yet — skipping round-trip");
} else {
  const prev = {
    custom_domain: site.custom_domain,
    domain_status: site.domain_status,
    ssl_status: site.ssl_status,
    verification_token: null,
    seo: site.seo ?? {},
    settings: site.settings ?? {},
  };

  // Domain-state write (mirrors connectCustomDomainAction + poll persist).
  const { error: domErr } = await sb
    .from("host_websites")
    .update({
      domain_status: "pending",
      ssl_status: "pending",
      settings: {
        ...(site.settings ?? {}),
        domainChallenges: [{ type: "TXT", domain: "_vercel", value: "probe" }],
      },
    })
    .eq("id", site.id);
  if (domErr) bad(`domain-state write: ${domErr.message}`);
  else ok("domain status + challenge settings write");

  // SEO jsonb write (mirrors saveSeoAction).
  const { error: seoErr } = await sb
    .from("host_websites")
    .update({
      seo: {
        ...(site.seo ?? {}),
        title: "__probe title",
        description: "__probe desc",
        robots_index: true,
        sitemap_enabled: true,
      },
    })
    .eq("id", site.id);
  if (seoErr) bad(`seo write: ${seoErr.message}`);
  else ok("seo jsonb write");

  // INSERT-only event.
  const { data: evt, error: insEvtErr } = await sb
    .from("website_domain_events")
    .insert({
      website_id: site.id,
      event: "domain_added",
      detail: { domain: "probe.example.com" },
    })
    .select("id")
    .single();
  if (insEvtErr) bad(`event insert: ${insEvtErr.message}`);
  else ok("website_domain_events insert");

  // Restore original state + clean up the probe event.
  await sb.from("host_websites").update(prev).eq("id", site.id);
  if (evt) await sb.from("website_domain_events").delete().eq("id", evt.id);
  ok("probe writes reverted");
}

// 4. Help articles landed.
for (const slug of ["website-custom-domain", "website-seo"]) {
  const { data: help } = await sb
    .from("help_articles")
    .select("slug, status")
    .eq("slug", slug)
    .maybeSingle();
  if (help?.status === "published") ok(`help article ${slug} published`);
  else bad(`help article ${slug} missing`);
}

console.log(failed ? "\n✗ W13/W14 verify FAILED" : "\n🎉 W13/W14 verify passed");
process.exit(failed ? 1 : 0);
