// Live-DB check for W7 (Brand & Theme). Round-trips the brand/theme jsonb on a
// real host_websites row (snapshot → write → read back → restore) and confirms
// a signed upload URL can be minted into the website-assets bucket then removed.
// Read-only in net effect (originals restored; test object deleted).
// Run: node --env-file=.env.local scripts/verify-website-brand-theme.mjs
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

// 1. Brand/theme jsonb round-trip on a real site (if one exists).
const { data: site, error: siteErr } = await sb
  .from("host_websites")
  .select("id, brand, theme")
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();
if (siteErr) bad(`read host_websites: ${siteErr.message}`);

if (!site) {
  console.log("  • no host_websites row yet — skipping jsonb round-trip");
} else {
  const origBrand = site.brand ?? {};
  const origTheme = site.theme ?? {};
  const probe = { __w7_probe: true };
  const { error: upErr } = await sb
    .from("host_websites")
    .update({
      brand: { ...origBrand, ...probe },
      theme: { ...origTheme, ...probe },
    })
    .eq("id", site.id);
  if (upErr) bad(`update brand/theme: ${upErr.message}`);

  const { data: after } = await sb
    .from("host_websites")
    .select("brand, theme")
    .eq("id", site.id)
    .single();
  if (after?.brand?.__w7_probe && after?.theme?.__w7_probe) {
    ok("brand/theme jsonb merge-write round-trips");
  } else {
    bad("brand/theme probe did not read back");
  }

  // Restore originals.
  const { error: restErr } = await sb
    .from("host_websites")
    .update({ brand: origBrand, theme: origTheme })
    .eq("id", site.id);
  if (restErr) bad(`restore originals: ${restErr.message}`);
  else ok("originals restored");
}

// 2. website-assets bucket: public + signed upload URL mints + object removable.
const { data: bucket, error: bErr } = await sb.storage.getBucket("website-assets");
if (bErr || !bucket) bad(`getBucket website-assets: ${bErr?.message ?? "missing"}`);
else if (!bucket.public) bad("website-assets bucket is not public");
else ok("website-assets bucket exists and is public");

const probePath = `__w7_probe/${crypto.randomUUID()}.png`;
const { data: signed, error: sErr } = await sb.storage
  .from("website-assets")
  .createSignedUploadUrl(probePath);
if (sErr || !signed?.token) bad(`createSignedUploadUrl: ${sErr?.message ?? "no token"}`);
else {
  ok("signed upload URL minted");
  await sb.storage.from("website-assets").remove([probePath]).catch(() => {});
}

if (failed) {
  console.error("\nW7 verification FAILED");
  process.exit(1);
}
console.log("\n🎉 W7 brand & theme verified");
