"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Search,
  Share2,
  BarChart3,
  Code2,
  X,
  Check,
  Settings2,
  type LucideIcon,
} from "lucide-react";

import { PAGE_PIXEL_EVENTS } from "@/app/[locale]/dashboard/website/schemas";

// Builder V2 — Phase 4b: Page Settings overlay (SEO / social / tracking / code).
//
// A pixel-faithful port of the prototype's `.ps-modal`: a centred modal with a
// left tab rail and a scrolling form. Edits the PageDoc's page-level `meta`
// (a loose record) via `onPatch`, so every change autosaves + is undoable with
// the doc. Phase 5-5 wires the public v2 render path to consume `meta.pixelEvent`
// (the conversion event below) + `meta.headCode`.

type Meta = Record<string, unknown>;

const PS_TABS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "seo", label: "SEO", Icon: Search },
  { key: "social", label: "Social share", Icon: Share2 },
  { key: "tracking", label: "Tracking & pixels", Icon: BarChart3 },
  { key: "code", label: "Custom code", Icon: Code2 },
];

const PIXELS: { key: string; label: string; ph: string; color: string }[] = [
  {
    key: "ga4",
    label: "GA4 measurement ID",
    ph: "G-XXXXXXXXXX",
    color: "#E8710A",
  },
  {
    key: "gtm",
    label: "Google Tag Manager",
    ph: "GTM-XXXXXXX",
    color: "#4285F4",
  },
  {
    key: "metaPixel",
    label: "Meta (Facebook) Pixel",
    ph: "123456789012345",
    color: "#1877F2",
  },
  {
    key: "tiktok",
    label: "TikTok Pixel",
    ph: "XXXXXXXXXXXXXXXX",
    color: "#111111",
  },
  {
    key: "gads",
    label: "Google Ads conversion",
    ph: "AW-XXXXXXXXX",
    color: "#34A853",
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
}: {
  open: boolean;
  onClose: () => void;
  docName: string;
  domain: string;
  meta: Meta;
  onPatch: (patch: Meta) => void;
}) {
  const [tab, setTab] = useState("seo");
  const set = (k: string, v: unknown) => onPatch({ [k]: v });

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
              <SocialTab meta={meta} domain={domain} set={set} />
            )}
            {tab === "tracking" && <TrackingTab meta={meta} set={set} />}
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
}: {
  meta: Meta;
  domain: string;
  set: (k: string, v: unknown) => void;
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
        <Field label="Share image URL">
          <input
            className="inp"
            value={ogImage}
            onChange={(e) => set("ogImage", e.target.value)}
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

function TrackingTab({
  meta,
  set,
}: {
  meta: Meta;
  set: (k: string, v: unknown) => void;
}) {
  const pixelEvent = str(meta, "pixelEvent") || "none";
  return (
    <>
      <h3 className="ps-h">Tracking &amp; pixels</h3>
      <Group title="Conversion event">
        <Field label="Fire on page view">
          <select
            className="inp"
            value={pixelEvent}
            onChange={(e) =>
              set("pixelEvent", e.target.value === "none" ? "" : e.target.value)
            }
          >
            {PAGE_PIXEL_EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {ev === "none" ? "No event" : ev}
              </option>
            ))}
          </select>
        </Field>
        <div className="hint">
          Fires this Meta Pixel / GA4 event when the published page loads — use
          it on a thank-you page to count a conversion.
        </div>
      </Group>
      <Group title="Analytics & pixels">
        {PIXELS.map((p) => {
          const v = str(meta, p.key);
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
                  onChange={(e) => set(p.key, e.target.value)}
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
          hint="Hold all tags until the visitor accepts cookies."
          value={bool(meta, "consent", true)}
          onChange={(v) => set("consent", v)}
        />
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
