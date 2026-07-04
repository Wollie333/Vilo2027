"use client";

import { useRef, useState } from "react";

import {
  createWebsiteMediaUploadUrl,
  registerWebsiteMediaAction,
} from "@/app/[locale]/dashboard/website/actions";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

// Reusable image control for the builder: upload a custom image (into the shared
// `website-assets` bucket, same chain as IconPicker) or paste a URL. Stores the
// resolved asset URL so the renderer's `url(...)` just works. Used for block/
// section background images (and any other image field going forward).

const ACCEPTED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
const MAX_BYTES = 8 * 1024 * 1024;

export function MediaField({
  value,
  onChange,
  websiteId,
}: {
  value?: string;
  onChange: (v: string) => void;
  websiteId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const src = value ? (websiteAssetUrl(value) ?? value) : "";

  async function upload(file: File) {
    setErr(null);
    if (!ACCEPTED.includes(file.type))
      return setErr("PNG, JPG, WebP, GIF or SVG only");
    if (file.size > MAX_BYTES) return setErr("Max 8 MB");
    if (!websiteId) return setErr("Save the page first to upload");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ticket = await createWebsiteMediaUploadUrl(websiteId, ext);
      if (!ticket.ok) return setErr("Upload failed");
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) return setErr("Upload failed");
      await registerWebsiteMediaAction(websiteId, ticket.data.path, {
        size: file.size,
        mime: file.type,
      });
      onChange(websiteAssetUrl(ticket.data.path) ?? ticket.data.path);
    } finally {
      setUploading(false);
    }
  }

  const btn: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 10px",
    borderRadius: 8,
    border: "1px solid var(--line)",
    background: "var(--surface, #fff)",
    color: "var(--ink)",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div
        aria-hidden
        style={{
          height: 72,
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: src
            ? `#0000 url("${src}") center/cover no-repeat`
            : "repeating-conic-gradient(var(--line) 0% 25%, transparent 0% 50%) 0 / 14px 14px",
          display: src ? undefined : "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--mute)",
          fontSize: 11,
        }}
      >
        {src ? null : "No image"}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          style={btn}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Uploading…" : src ? "Replace" : "Upload image"}
        </button>
        {src ? (
          <button type="button" style={btn} onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
      <input
        className="inp"
        type="text"
        value={value ?? ""}
        placeholder="…or paste an image URL"
        onChange={(e) => onChange(e.target.value.trim())}
      />
      {err ? (
        <p style={{ margin: 0, fontSize: 11, color: "#dc2626" }}>{err}</p>
      ) : null}
    </div>
  );
}
