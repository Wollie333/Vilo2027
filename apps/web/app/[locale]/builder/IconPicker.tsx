"use client";

import { useMemo, useRef, useState } from "react";

import {
  createWebsiteMediaUploadUrl,
  registerWebsiteMediaAction,
} from "@/app/[locale]/dashboard/website/actions";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";
import {
  LUCIDE_ICONS,
  LUCIDE_ICON_NAMES,
  LUCIDE_PREFIX,
  isLucideIcon,
  lucideIconFor,
} from "@/lib/website/icons/lucideCatalog";

// Elementor-style icon control: pick a free Lucide icon, type an emoji, or upload
// an image / SVG. The value stored on the node is `lucide:<name>`, a raw emoji/
// character, or an uploaded asset URL — all three understood by `SiteIcon`.

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 6 * 1024 * 1024;

function isImageValue(v?: string | null): boolean {
  if (!v) return false;
  return (
    /^(https?:\/\/|\/|data:image\/)/.test(v) ||
    /\.(svg|png|jpe?g|webp|gif)$/i.test(v)
  );
}

/** A small preview of whatever the icon value currently is. */
function Preview({ value, size = 20 }: { value?: string; size?: number }) {
  if (isLucideIcon(value)) {
    const Icon = lucideIconFor(value);
    return Icon ? <Icon size={size} strokeWidth={1.8} /> : null;
  }
  if (isImageValue(value)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={websiteAssetUrl(value) ?? value}
        alt=""
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }
  if (value)
    return <span style={{ fontSize: size, lineHeight: 1 }}>{value}</span>;
  return <span style={{ opacity: 0.4, fontSize: size * 0.7 }}>—</span>;
}

type Tab = "icons" | "emoji" | "upload";

export function IconPicker({
  value,
  onChange,
  websiteId,
}: {
  value?: string;
  onChange: (v: string) => void;
  websiteId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("icons");
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return LUCIDE_ICON_NAMES;
    return LUCIDE_ICON_NAMES.filter((n) => n.includes(s));
  }, [q]);

  async function upload(file: File) {
    setErr(null);
    if (!ACCEPTED.includes(file.type))
      return setErr("PNG, JPG, WebP or SVG only");
    if (file.size > MAX_BYTES) return setErr("Max 6 MB");
    if (!websiteId) return setErr("Save the page first to upload");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const ticket = await createWebsiteMediaUploadUrl(websiteId, ext);
      if (!ticket.ok) return setErr("Upload failed");
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/png",
        });
      if (error) return setErr("Upload failed");
      await registerWebsiteMediaAction(websiteId, ticket.data.path, {
        size: file.size,
        mime: file.type,
      });
      onChange(websiteAssetUrl(ticket.data.path) ?? ticket.data.path);
      setOpen(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="iconpick">
      <button
        type="button"
        className="iconpick-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="iconpick-preview">
          <Preview value={value} />
        </span>
        <span className="iconpick-cur">
          {isLucideIcon(value)
            ? value!.slice(LUCIDE_PREFIX.length)
            : isImageValue(value)
              ? "Uploaded image"
              : value
                ? "Emoji"
                : "Choose icon"}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            className="iconpick-clear"
            title="Remove icon"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            ×
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="iconpick-pop">
          <div className="iconpick-tabs">
            {(
              [
                ["icons", "Icons"],
                ["emoji", "Emoji"],
                ["upload", "Upload"],
              ] as [Tab, string][]
            ).map(([t, l]) => (
              <button
                key={t}
                type="button"
                className={tab === t ? "on" : undefined}
                onClick={() => setTab(t)}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "icons" ? (
            <>
              <input
                className="inp iconpick-search"
                placeholder="Search icons…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="iconpick-grid">
                {matches.map((name) => {
                  const Icon = LUCIDE_ICONS[name];
                  const sel = value === `${LUCIDE_PREFIX}${name}`;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      className={sel ? "on" : undefined}
                      onClick={() => {
                        onChange(`${LUCIDE_PREFIX}${name}`);
                        setOpen(false);
                      }}
                    >
                      <Icon size={20} strokeWidth={1.8} />
                    </button>
                  );
                })}
                {matches.length === 0 ? (
                  <div className="iconpick-empty">No icons match “{q}”.</div>
                ) : null}
              </div>
            </>
          ) : null}

          {tab === "emoji" ? (
            <div className="iconpick-emoji">
              <input
                className="inp"
                placeholder="Paste an emoji or character…"
                value={
                  isLucideIcon(value) || isImageValue(value)
                    ? ""
                    : (value ?? "")
                }
                onChange={(e) => onChange(e.target.value)}
              />
              <p className="iconpick-hint">
                Any emoji or single character, e.g. 🌊 ★ ✓
              </p>
            </div>
          ) : null}

          {tab === "upload" ? (
            <div className="iconpick-upload">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(",")}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="iconpick-uploadbtn"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Uploading…" : "Upload image / SVG"}
              </button>
              <p className="iconpick-hint">
                PNG, JPG, WebP or SVG · up to 6 MB
              </p>
              {err ? <p className="iconpick-err">{err}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
