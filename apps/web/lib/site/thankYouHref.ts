/**
 * Builds a working conversion-goal thank-you URL from the CURRENT browser
 * location, preserving the tenant site's base path + `site` param so it resolves
 * on BOTH path-based (`?site=…`) test/preview sites AND live subdomains. The
 * public form bands call this after a successful submission.
 *
 * Path-based tenant pages are served under `…/site/<page>`; we capture that base
 * and hang `/thank-you[/goal]` off it. On a live subdomain there is no `/site`
 * segment in the visible path (middleware rewrites it), so the base is the root
 * and `/thank-you/<goal>` rewrites correctly too.
 *
 * Browser-only — reads `window.location`; call from a client event handler.
 */
export function siteThankYouHref(opts: {
  /** Form conversion goal — `general` (or omitted) → the base thank-you page. */
  goal?: string;
  /** Visitor first name, for a warmer heading. */
  name?: string;
  /** Form id, so the thank-you page can show the host's per-form copy. */
  formId?: string;
}): string {
  const u = new URL(window.location.href);
  const siteParam = u.searchParams.get("site");
  const m = u.pathname.match(/^(.*\/site)(?:\/|$)/);
  const base = m ? m[1] : "";
  const goalPath = opts.goal && opts.goal !== "general" ? `/${opts.goal}` : "";
  const url = new URL(`${base}/thank-you${goalPath}`, u.origin);
  if (siteParam) url.searchParams.set("site", siteParam);
  if (opts.formId) url.searchParams.set("form", opts.formId);
  if (opts.name) url.searchParams.set("name", opts.name);
  return url.toString();
}
