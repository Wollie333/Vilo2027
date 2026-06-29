// Pure helpers for the custom-domain feature (W13). No I/O — safe to import
// from server actions, the poll worker, verify scripts and (display-only bits)
// the client. The Vercel API wrapper lives in `vercel.ts`; the polling logic in
// `domain-poll.ts`.

/** Vercel's published static targets for project domains. */
export const VERCEL_A_RECORD = "76.76.21.21";
export const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

export type DnsRecord = {
  /** A | CNAME | TXT */
  type: "A" | "CNAME" | "TXT";
  /** Host/name portion the user enters at their registrar ("@" for apex). */
  name: string;
  /** Record value/target. */
  value: string;
};

/**
 * Normalise raw user input into a bare hostname: lowercased, protocol +
 * path + port + trailing dot stripped. Does NOT strip a leading `www.` — a host
 * who types `www.example.com` means that exact host.
 */
export function normaliseDomain(input: string): string {
  let d = (input || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/\/.*$/, ""); // path
  d = d.replace(/:\d+$/, ""); // port
  d = d.replace(/\.$/, ""); // trailing dot
  return d;
}

const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const DOMAIN_RE = new RegExp(`^(?:${LABEL}\\.)+[a-z]{2,}$`);

/**
 * Validate a normalised custom domain. Returns an error CODE (i18n key suffix)
 * or null when valid. Rejects bare labels, the platform root domain and any of
 * its subdomains (those are served by the wildcard, not a custom domain).
 */
export function validateDomain(input: string): string | null {
  const d = normaliseDomain(input);
  if (!d) return "domainRequired";
  if (d.length > 253) return "domainInvalid";
  if (!DOMAIN_RE.test(d)) return "domainInvalid";

  const root = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site"
  ).toLowerCase();
  if (d === root || d.endsWith(`.${root}`)) return "domainIsRoot";

  return null;
}

/** A registrable apex (exactly two labels, e.g. `example.com`) vs a subdomain. */
export function isApex(domain: string): boolean {
  const d = normaliseDomain(domain);
  // Naive but adequate for the records hint: apex = label.tld (2 parts). Hosts
  // on a multi-part TLD (e.g. co.za) who use the apex should follow the CNAME
  // fallback their registrar offers — we surface BOTH options in the UI anyway.
  return d.split(".").length === 2;
}

/**
 * The DNS records a host must add for a custom domain. The apex needs an A
 * record at the root; a subdomain needs a CNAME. `extraTxt` carries any TXT
 * ownership challenges Vercel returned (the `_vercel` records).
 */
export function dnsRecordsFor(
  domain: string,
  extraTxt: Array<{ name?: string | null; value?: string | null }> = [],
): DnsRecord[] {
  const d = normaliseDomain(domain);
  const records: DnsRecord[] = [];

  if (isApex(d)) {
    records.push({ type: "A", name: "@", value: VERCEL_A_RECORD });
  } else {
    const sub = d.split(".")[0];
    records.push({ type: "CNAME", name: sub, value: VERCEL_CNAME_TARGET });
  }

  for (const txt of extraTxt) {
    if (!txt?.value) continue;
    records.push({
      type: "TXT",
      name: (txt.name && txt.name.trim()) || "_vercel",
      value: txt.value,
    });
  }

  return records;
}
