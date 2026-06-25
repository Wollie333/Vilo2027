// Resolve a `website-assets` storage path to its public URL. The bucket is
// public, so the URL is deterministic from the path — no signing needed. Values
// that are already absolute URLs (e.g. preview sample data) pass through.
//
// Single source of truth shared by the public site loader, the site asset
// resolver and the dashboard editor (logo preview). Safe on client + server
// (reads only the NEXT_PUBLIC_ Supabase URL).

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";

export function websiteAssetUrl(path?: string | null): string | null {
  if (!path) return null;
  // Absolute URLs and inline data URIs (e.g. the theme preview SVG) pass through.
  if (/^(https?:\/\/|data:)/.test(path)) return path;
  return SUPA
    ? `${SUPA}/storage/v1/object/public/website-assets/${path}`
    : path;
}
