"use client";

// Media-library modal: the shared "upload OR pick from your library" picker that
// opens whenever a MediaControl/MediaField upload button is clicked (via the
// MediaPicker context). Lists the site's uploaded assets, uploads new ones (same
// signed-URL chain as MediaField), and returns the chosen image URL.

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";

import {
  createWebsiteMediaUploadUrl,
  listWebsiteMediaAction,
  registerWebsiteMediaAction,
  type MediaItem,
} from "@/app/[locale]/dashboard/website/actions";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

const ACCEPTED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
const MAX_BYTES = 8 * 1024 * 1024;

export function MediaLibraryModal({
  open,
  websiteId,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  /** Undefined in demo/unsaved mode → library + upload disabled, URL still works. */
  websiteId?: string;
  current?: string;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!websiteId) return;
    setLoading(true);
    const res = await listWebsiteMediaAction(websiteId);
    setLoading(false);
    if (res.ok) setItems(res.items);
  }, [websiteId]);

  useEffect(() => {
    if (open) {
      setErr(null);
      setUrl("");
      void refresh();
    }
  }, [open, refresh]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function upload(file: File) {
    setErr(null);
    if (!ACCEPTED.includes(file.type))
      return setErr("PNG, JPG, WebP, GIF or SVG only");
    if (file.size > MAX_BYTES) return setErr("Max 8 MB");
    if (!websiteId) return setErr("Save the page first to upload");
    setBusy(true);
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
      const picked = websiteAssetUrl(ticket.data.path) ?? ticket.data.path;
      onPick(picked);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div style={S.backdrop} role="dialog" aria-modal="true" onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <header style={S.head}>
          <span style={S.title}>
            <ImagePlus size={17} strokeWidth={2} /> Media library
          </span>
          <button type="button" style={S.x} title="Close" onClick={onClose}>
            <X size={17} strokeWidth={2} />
          </button>
        </header>

        <div style={S.body}>
          <label
            style={{ ...S.drop, ...(busy ? S.dropBusy : null) }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void upload(f);
            }}
          >
            <UploadCloud size={22} strokeWidth={1.8} />
            <b>{busy ? "Uploading…" : "Upload an image"}</b>
            <span>
              {websiteId
                ? "Drag & drop or click to browse"
                : "Save the page first to upload"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(",")}
              hidden
              disabled={!websiteId || busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </label>

          {err ? <p style={S.err}>{err}</p> : null}

          <div style={S.libHead}>
            Your library
            {loading ? <span style={S.dim}> · loading…</span> : null}
          </div>
          {items.length === 0 && !loading ? (
            <p style={S.empty}>
              {websiteId
                ? "No uploads yet — add your first image above."
                : "The media library is available once the site is saved."}
            </p>
          ) : (
            <div style={S.grid}>
              {items.map((m) => {
                const selected = current === m.url || current === m.path;
                return (
                  <button
                    key={m.path}
                    type="button"
                    title={m.name}
                    style={{
                      ...S.tile,
                      ...(selected ? S.tileOn : null),
                      backgroundImage: `url("${m.url}")`,
                    }}
                    onClick={() => {
                      onPick(m.url);
                      onClose();
                    }}
                  />
                );
              })}
            </div>
          )}

          <div style={S.urlRow}>
            <input
              style={S.urlInput}
              type="text"
              placeholder="…or paste an image URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="button"
              style={{ ...S.useBtn, ...(url.trim() ? null : S.useBtnOff) }}
              disabled={!url.trim()}
              onClick={() => {
                onPick(url.trim());
                onClose();
              }}
            >
              Use URL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    background: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  panel: {
    width: "min(680px, 96vw)",
    maxHeight: "88vh",
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid #e5e7eb",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
  },
  x: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: 0,
    background: "none",
    color: "#64748b",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: 18,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  drop: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "22px 16px",
    border: "1.5px dashed #cbd5e1",
    borderRadius: 12,
    background: "#f8fafc",
    color: "#475569",
    cursor: "pointer",
    textAlign: "center",
  },
  dropBusy: { opacity: 0.7, cursor: "default" },
  err: { margin: 0, fontSize: 12, color: "#dc2626" },
  libHead: {
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    letterSpacing: "0.02em",
  },
  dim: { fontWeight: 500, color: "#94a3b8" },
  empty: { margin: 0, fontSize: 13, color: "#94a3b8" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
    gap: 10,
  },
  tile: {
    aspectRatio: "1 / 1",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f1f5f9 center/cover no-repeat",
    cursor: "pointer",
    padding: 0,
  },
  tileOn: {
    outline: "3px solid #10b981",
    outlineOffset: 1,
    borderColor: "#10b981",
  },
  urlRow: {
    display: "flex",
    gap: 8,
    borderTop: "1px solid #eef2f7",
    paddingTop: 14,
  },
  urlInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    padding: "9px 11px",
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    color: "#0f172a",
  },
  useBtn: {
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 16px",
    borderRadius: 9,
    border: 0,
    background: "#10b981",
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  useBtnOff: { opacity: 0.5, cursor: "default" },
};
