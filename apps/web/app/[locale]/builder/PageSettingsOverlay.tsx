"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Search,
  Share2,
  BarChart3,
  Zap,
  Code2,
  X,
  Check,
  Settings2,
  type LucideIcon,
} from "lucide-react";

import { MediaField } from "./MediaField";

// Builder V2 — Phase 4b: Page Settings overlay (SEO / social / tracking / code).
//
// A pixel-faithful port of the prototype's `.ps-modal`: a centred modal with a
// left tab rail and a scrolling form. Edits the PageDoc's page-level `meta`
// (a loose record) via `onPatch`, so every change autosaves + is undoable with
// the doc. Phase 5-5 wires the public v2 render path to consume `meta.pixelEvent`
// (the conversion event below) + `meta.headCode`.

type Meta = Record<string, unknown>;

/** Site-wide analytics/pixel IDs (one `settings.analytics` record for every
 *  page). Flat working shape edited in the Tracking tab; persisted via
 *  `saveBuilderAnalyticsAction`. */
export type BuilderAnalytics = {
  ga4: string;
  metaPixel: string;
  gtm: string;
  tiktok: string;
  googleAds: string;
  cookieConsentEnabled: boolean;
  cookieConsentMessage: string;
  privacyHref: string;
};

export const EMPTY_ANALYTICS: BuilderAnalytics = {
  ga4: "",
  metaPixel: "",
  gtm: "",
  tiktok: "",
  googleAds: "",
  cookieConsentEnabled: true,
  cookieConsentMessage: "",
  privacyHref: "",
};

// Site-wide pixel fields shown in the Tracking tab — every one is injected on the
// public site (consent-gated) by components/site/SiteMarketing.tsx.
const SITE_PIXELS: {
  key: keyof BuilderAnalytics;
  label: string;
  ph: string;
  color: string;
}[] = [
  {
    key: "ga4",
    label: "GA4 measurement ID",
    ph: "G-XXXXXXXXXX",
    color: "#E8710A",
  },
  {
    key: "metaPixel",
    label: "Meta (Facebook) Pixel",
    ph: "123456789012345",
    color: "#1877F2",
  },
  {
    key: "gtm",
    label: "Google Tag Manager",
    ph: "GTM-XXXXXXX",
    color: "#4285F4",
  },
  {
    key: "tiktok",
    label: "TikTok Pixel",
    ph: "CXXXXXXXXXXXXXXXXXXX",
    color: "#111111",
  },
  {
    key: "googleAds",
    label: "Google Ads conversion",
    ph: "AW-XXXXXXXXX",
    color: "#34A853",
  },
];

const PS_TABS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "seo", label: "SEO", Icon: Search },
  { key: "social", label: "Social share", Icon: Share2 },
  { key: "tracking", label: "Tracking & pixels", Icon: BarChart3 },
  { key: "events", label: "Events", Icon: Zap },
  { key: "code", label: "Custom code", Icon: Code2 },
];

// Curated built-in Meta/GA events a host can fire on THIS page (stored in
// `meta.events`). Page-load events only — Purchase is auto on booking
// confirmation (shown as an info row, not a toggle).
const BUILTIN_EVENTS: { key: string; label: string; hint: string }[] = [
  {
    key: "Lead",
    label: "Lead",
    hint: "A contact / enquiry form was submitted — use on a contact thank-you.",
  },
  {
    key: "Subscribe",
    label: "Subscribe",
    hint: "A newsletter sign-up completed.",
  },
  {
    key: "Contact",
    label: "Contact",
    hint: "The visitor initiated contact (call / email / WhatsApp).",
  },
  {
    key: "CompleteRegistration",
    label: "Complete registration",
    hint: "An account or booking registration finished.",
  },
  {
    key: "ViewContent",
    label: "View content",
    hint: "A key page (a room, a special) was viewed.",
  },
  {
    key: "Search",
    label: "Search",
    hint: "The visitor ran an availability search.",
  },
  {
    key: "InitiateCheckout",
    label: "Initiate checkout",
    hint: "The visitor started the booking checkout.",
  },
];

const str = (m: Meta, k: string): string =>
  typeof m[k] === "string" ? (m[k] as string) : "";
const bool = (m: Meta, k: string, dflt = false): boolean =>
  typeof m[k] === "boolean" ? (m[k] as boolean) : dflt;

export function PageSettingsOverlay({
  open,
  onClose,
  docName,
  domain,
  meta,
  onPatch,
  analytics,
  onAnalyticsPatch,
  websiteId,
}: {
  open: boolean;
  onClose: () => void;
  docName: string;
  domain: string;
  meta: Meta;
  onPatch: (patch: Meta) => void;
  /** Enables the share-image upload (media library). */
  websiteId?: string;
  /** Site-wide analytics IDs (shared by every page). */
  analytics: BuilderAnalytics;
  /** Patch the site-wide analytics record (persists to settings.analytics). */
  onAnalyticsPatch: (patch: Partial<BuilderAnalytics>) => void;
}) {
  const [tab, setTab] = useState("seo");
  const set = (k: string, v: unknown) => onPatch({ [k]: v });
  const setA = (k: keyof BuilderAnalytics, v: unknown) =>
    onAnalyticsPatch({ [k]: v } as Partial<BuilderAnalytics>);

  // Each time the modal opens, start on the SEO tab (matches the prototype).
  useEffect(() => {
    if (open) setTab("seo");
  }, [open]);

  return (
    <div
      className={open ? "scrim ps-scrim show" : "scrim ps-scrim"}
      onClick={onClose}
    >
      <div
        className="ps-modal"
        role="dialog"
        aria-label="Page settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ps-side">
          <div className="ps-side-h">
            <span className="ps-mark">
              <Settings2 size={17} strokeWidth={1.9} />
            </span>
            <div>
              <b>Page settings</b>
              <small>{docName}</small>
            </div>
          </div>
          <nav className="ps-nav">
            {PS_TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={key === tab ? "ps-navi on" : "ps-navi"}
                onClick={() => setTab(key)}
              >
                <Icon size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="ps-side-foot">
            <Check size={14} strokeWidth={2} />
            Saved automatically
          </div>
        </div>

        <div className="ps-main">
          <button
            className="ps-x"
            type="button"
            title="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
          <div className="ps-body">
            {tab === "seo" && <SeoTab meta={meta} domain={domain} set={set} />}
            {tab === "social" && (
              <SocialTab
                meta={meta}
                domain={domain}
                set={set}
                websiteId={websiteId}
              />
            )}
            {tab === "tracking" && (
              <TrackingTab analytics={analytics} setA={setA} />
            )}
            {tab === "events" && <EventsTab meta={meta} set={set} />}
            {tab === "code" && <CodeTab meta={meta} set={set} />}
          </div>
          <div className="ps-foot">
            <button className="tb-btn solid" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── tabs ──────────────────────────────────────────────────────
function SeoTab({
  meta,
  domain,
  set,
}: {
  meta: Meta;
  domain: string;
  set: (k: string, v: unknown) => void;
}) {
  const title = str(meta, "seoTitle");
  const desc = str(meta, "metaDesc");
  const slug = str(meta, "slug");
  return (
    <>
      <h3 className="ps-h">SEO</h3>
      <Group title="Search engine preview">
        <div className="serp">
          <div className="serp-url">
            {domain} › <span>{slug || "…"}</span>
          </div>
          <div className="serp-title">{title || "Your page title"}</div>
          <div className="serp-desc">
            {desc || "Your meta description shows here in search results."}
          </div>
        </div>
      </Group>
      <Group title="Basics">
        <Field label="Meta title" count={title.length} max={60}>
          <input
            className="inp"
            maxLength={65}
            value={title}
            onChange={(e) => set("seoTitle", e.target.value)}
          />
        </Field>
        <Field label="Meta description" count={desc.length} max={160}>
          <textarea
            className="inp"
            maxLength={165}
            style={{ minHeight: 78 }}
            value={desc}
            onChange={(e) => set("metaDesc", e.target.value)}
          />
        </Field>
        <Field label="URL slug">
          <div className="slug">
            <span>/</span>
            <input
              className="inp"
              value={slug}
              onChange={(e) => set("slug", e.target.value)}
            />
          </div>
        </Field>
        <Field label="Focus keyword">
          <input
            className="inp"
            value={str(meta, "keyword")}
            placeholder="e.g. karoo guesthouse"
            onChange={(e) => set("keyword", e.target.value)}
          />
        </Field>
      </Group>
      <Group title="Indexing">
        <ToggleRow
          label="Allow search engines"
          hint="When off, a noindex tag is added to this page."
          value={bool(meta, "index", true)}
          onChange={(v) => set("index", v)}
        />
        <Field label="Canonical URL">
          <input
            className="inp"
            value={str(meta, "canonical")}
            placeholder="Leave blank to use this page’s URL"
            onChange={(e) => set("canonical", e.target.value)}
          />
        </Field>
      </Group>
    </>
  );
}

function SocialTab({
  meta,
  domain,
  set,
  websiteId,
}: {
  meta: Meta;
  domain: string;
  set: (k: string, v: unknown) => void;
  websiteId?: string;
}) {
  const ogTitle = str(meta, "ogTitle") || str(meta, "seoTitle");
  const ogDesc = str(meta, "ogDesc") || str(meta, "metaDesc");
  const ogImage = str(meta, "ogImage");
  const card = str(meta, "twitterCard") || "summary_large_image";
  return (
    <>
      <h3 className="ps-h">Social share</h3>
      <Group title="Share preview">
        <div className="ogcard">
          <div
            className="ogimg"
            style={ogImage ? { backgroundImage: `url(${ogImage})` } : undefined}
          />
          <div className="ogmeta">
            <div className="ogsite">{domain.toUpperCase()}</div>
            <div className="ogtitle">{ogTitle || "Your page title"}</div>
            <div className="ogdesc">
              {ogDesc || "How this page looks when shared on social."}
            </div>
          </div>
        </div>
      </Group>
      <Group title="Open Graph & Twitter">
        <Field label="Social title">
          <input
            className="inp"
            value={str(meta, "ogTitle")}
            placeholder="Defaults to meta title"
            onChange={(e) => set("ogTitle", e.target.value)}
          />
        </Field>
        <Field label="Social description">
          <textarea
            className="inp"
            value={str(meta, "ogDesc")}
            placeholder="Defaults to meta description"
            onChange={(e) => set("ogDesc", e.target.value)}
          />
        </Field>
        <Field label="Share image">
          <MediaField
            value={ogImage}
            onChange={(v) => set("ogImage", v)}
            websiteId={websiteId}
          />
        </Field>
        <Field label="Twitter card">
          <div className="seg">
            {[
              ["summary", "Small"],
              ["summary_large_image", "Large"],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                className={card === v ? "on" : undefined}
                onClick={() => set("twitterCard", v)}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
      </Group>
    </>
  );
}

function EventsTab({
  meta,
  set,
}: {
  meta: Meta;
  set: (k: string, v: unknown) => void;
}) {
  const enabled: string[] = Array.isArray(meta.events)
    ? (meta.events as unknown[]).filter(
        (e): e is string => typeof e === "string",
      )
    : [];
  const toggle = (key: string, on: boolean) => {
    const next = on
      ? Array.from(new Set([...enabled, key]))
      : enabled.filter((e) => e !== key);
    set("events", next);
  };
  return (
    <>
      <h3 className="ps-h">Events</h3>
      <Group title="Fire on this page">
        <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
          These Meta Pixel / GA4 events fire when this published page loads.
          Turn on the ones that match what this page does (e.g. Lead on a
          contact thank-you).
        </div>
        {BUILTIN_EVENTS.map((ev) => (
          <ToggleRow
            key={ev.key}
            label={ev.label}
            hint={ev.hint}
            value={enabled.includes(ev.key)}
            onChange={(v) => toggle(ev.key, v)}
          />
        ))}
      </Group>
      <Group title="Purchase (automatic)">
        <div className="hint" style={{ margin: 0 }}>
          The <b>Purchase</b> event fires automatically on the booking
          confirmation page with the order’s value &amp; currency — no setup
          needed.
        </div>
      </Group>
    </>
  );
}

function TrackingTab({
  analytics,
  setA,
}: {
  analytics: BuilderAnalytics;
  setA: (k: keyof BuilderAnalytics, v: unknown) => void;
}) {
  return (
    <>
      <h3 className="ps-h">Tracking &amp; pixels</h3>
      <Group title="Pixels & analytics">
        <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
          These IDs apply to <b>every page</b> on your site. Editing them here
          changes them everywhere.
        </div>
        {SITE_PIXELS.map((p) => {
          const v = String(analytics[p.key] ?? "");
          const on = v.trim().length > 0;
          return (
            <div className="pixrow" key={p.key}>
              <div
                className="pixdot"
                style={{ background: p.color, opacity: on ? 1 : 0.25 }}
              />
              <div className="pixmain">
                <label>{p.label}</label>
                <input
                  className="inp"
                  value={v}
                  placeholder={p.ph}
                  onChange={(e) => setA(p.key, e.target.value)}
                />
              </div>
              <div className="pixstate">{on ? "Active" : "Off"}</div>
            </div>
          );
        })}
      </Group>
      <Group title="Consent">
        <ToggleRow
          label="Cookie-consent gating"
          hint="Hold all tags until the visitor accepts cookies (POPIA)."
          value={analytics.cookieConsentEnabled}
          onChange={(v) => setA("cookieConsentEnabled", v)}
        />
        <Field label="Consent message">
          <input
            className="inp"
            value={analytics.cookieConsentMessage}
            placeholder="We use cookies to improve your experience."
            onChange={(e) => setA("cookieConsentMessage", e.target.value)}
          />
        </Field>
        <Field label="Privacy policy link">
          <input
            className="inp"
            value={analytics.privacyHref}
            placeholder="/privacy or https://…"
            onChange={(e) => setA("privacyHref", e.target.value)}
          />
        </Field>
      </Group>
    </>
  );
}

function CodeTab({
  meta,
  set,
}: {
  meta: Meta;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <>
      <h3 className="ps-h">Custom code</h3>
      <Group title="Custom code">
        <Field label="<head> code">
          <textarea
            className="inp code"
            value={str(meta, "headCode")}
            placeholder="<!-- injected into <head> -->"
            onChange={(e) => set("headCode", e.target.value)}
          />
        </Field>
        <Field label="Body-end code">
          <textarea
            className="inp code"
            value={str(meta, "bodyCode")}
            placeholder="<!-- injected before </body> -->"
            onChange={(e) => set("bodyCode", e.target.value)}
          />
        </Field>
        <div className="hint">
          Snippets are injected on the published page only — never in this
          editor.
        </div>
      </Group>
    </>
  );
}

// ── shared bits ───────────────────────────────────────────────
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ps-group">
      <h5>{title}</h5>
      {children}
    </div>
  );
}

function Field({
  label,
  count,
  max,
  children,
}: {
  label: string;
  count?: number;
  max?: number;
  children: ReactNode;
}) {
  return (
    <div className="ctl">
      <div className="ctl-l">
        <label>{label}</label>
        {count != null && max != null && (
          <span className={count > max ? "val over" : "val"}>
            {count}/{max}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="ctl">
      <div className="togrow">
        <div>
          <label>{label}</label>
          <div className="hint">{hint}</div>
        </div>
        <div
          className={value ? "tog on" : "tog"}
          onClick={() => onChange(!value)}
        />
      </div>
    </div>
  );
}
