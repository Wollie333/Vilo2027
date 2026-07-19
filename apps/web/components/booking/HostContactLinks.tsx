import {
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Music2,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";

// Guest-facing host/business contact details, shown on every booking surface's
// "Your host" card (success page + trip page). Wielo is a DIRECT-booking
// platform, so once a guest has booked they should be able to reach the host any
// way they offer — website, phone, email, socials. Website + socials belong to
// the BUSINESS entity (like its banking); phone + email are the host's contact
// already printed on the guest's invoice. Each field renders only when set, and
// the whole block collapses when nothing real is shared.

export type HostContact = {
  website: string | null;
  phone: string | null;
  email: string | null;
  /** Business social accounts, {platform: url_or_handle}. */
  socials?: Record<string, string> | null;
};

// Icon + display order for known social platforms. Unknown keys are ignored.
const SOCIAL_META: Record<string, { label: string; Icon: typeof Instagram }> = {
  instagram: { label: "Instagram", Icon: Instagram },
  facebook: { label: "Facebook", Icon: Facebook },
  x: { label: "X", Icon: Twitter },
  tiktok: { label: "TikTok", Icon: Music2 },
  youtube: { label: "YouTube", Icon: Youtube },
  linkedin: { label: "LinkedIn", Icon: Linkedin },
};
const SOCIAL_ORDER = Object.keys(SOCIAL_META);

function trimmed(v: string | null): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

// A website only counts as real when it's actually a domain — a non-empty value
// whose host part contains a dot. This hides blanks AND placeholder junk (e.g.
// "n/a", "tbd", "coming soon") so we never render a bogus website link.
function cleanWebsite(v: string | null): string | null {
  const t = trimmed(v);
  if (!t) return null;
  const host = t.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  return host.includes(".") && !/\s/.test(host) ? t : null;
}

// An email only counts when it's shaped like one.
function cleanEmail(v: string | null): string | null {
  const t = trimmed(v);
  return t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

const rowClass =
  "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12.5px] text-brand-ink transition hover:bg-brand-light/70";

export function HostContactLinks({ contact }: { contact: HostContact }) {
  // Sanitise each field so only genuine, non-blank data ever renders.
  const website = cleanWebsite(contact.website);
  const phone = trimmed(contact.phone);
  const email = cleanEmail(contact.email);
  const socials = SOCIAL_ORDER.map((key) => {
    const raw = trimmed((contact.socials ?? {})[key] ?? null);
    return raw ? { key, url: normalizeUrl(raw), ...SOCIAL_META[key] } : null;
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  if (!website && !phone && !email && socials.length === 0) return null;

  return (
    <div className="mt-4 space-y-0.5 border-t border-brand-line pt-3">
      <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
        Contact
      </div>
      {website ? (
        <a
          href={normalizeUrl(website)}
          target="_blank"
          rel="noopener noreferrer"
          className={rowClass}
        >
          <Globe className="h-4 w-4 shrink-0 text-brand-primary" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {prettyUrl(website)}
          </span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-brand-mute" />
        </a>
      ) : null}
      {phone ? (
        <a href={`tel:${phone.replace(/\s+/g, "")}`} className={rowClass}>
          <Phone className="h-4 w-4 shrink-0 text-brand-primary" />
          <span className="min-w-0 flex-1 truncate font-medium">{phone}</span>
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className={rowClass}>
          <Mail className="h-4 w-4 shrink-0 text-brand-primary" />
          <span className="min-w-0 flex-1 truncate font-medium">{email}</span>
        </a>
      ) : null}
      {socials.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-1.5">
          {socials.map(({ key, url, label, Icon }) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-line text-brand-secondary transition hover:border-brand-primary/50 hover:bg-brand-light hover:text-brand-primary"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
