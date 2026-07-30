// Canonical affiliate link builders — ONE definition, used by the portal, the
// race page, the campaign cards and the link builder so a partner never sees two
// different URLs for the same thing.
//
// Referral capture always happens at /r/<slug> (the only cookie-dropping route;
// ?c=<campaign> tags the competition and captures its rate server-side). The
// partner never has to share that raw link, though: their COMPETITION link is
// their co-branded landing page /partners/<slug>?c=<campaign>, whose every CTA
// routes through /r/<slug>?c=<campaign> — so it attributes and rate-locks exactly
// like the raw link but reads like "the partner's page".
//
// The old /c/<campaign>/<partner> shape 404'd: /c/<slug> is the category
// taxonomy, not an affiliate route. These helpers replace it everywhere.

/** Strip protocol for a compact on-screen display of a link. */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/** The partner's DEFAULT programme link (no competition). */
export function partnerDefaultLink(
  baseUrl: string,
  partnerSlug: string,
): string {
  return `${baseUrl}/r/${partnerSlug}`;
}

/**
 * The partner's ONE competition link — their co-branded landing page, tagged to
 * the campaign. This is the single link to show and share for a competition.
 */
export function campaignPartnerLink(
  baseUrl: string,
  partnerSlug: string,
  campaignSlug: string,
): string {
  return `${baseUrl}/partners/${partnerSlug}?c=${encodeURIComponent(campaignSlug)}`;
}
