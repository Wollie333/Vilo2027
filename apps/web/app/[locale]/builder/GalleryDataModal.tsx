"use client";

// Builder V2 — Phase 4b-5. The "Edit photos" modal for the property-sourced
// `gallery` (Wielo) block. Photos live in property_photos (property-wide = room_id
// null), not on the website. This modal manages them with the SAME signed-URL
// upload the Properties manager uses (browser → Storage → register row) + delete,
// then refreshes the canvas. Theme styles the gallery; the system owns the photos.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchBuilderGalleryAction,
  type BuilderGalleryProperty,
  type BuilderPhoto,
} from "@/app/[locale]/dashboard/website/actions";
import {
  createListingPhotoUploadUrl,
  registerListingPhotoAction,
  deleteListingPhotoAction,
} from "@/app/[locale]/dashboard/properties/[id]/edit/actions";

export function GalleryDataModal({
  open,
  onClose,
  toast,
  websiteId,
}: {
  open: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
  websiteId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [properties, setProperties] = useState<BuilderGalleryProperty[] | null>(
    null,
  );
  const [propId, setPropId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProperties(null);
    setError(null);
    const res = await fetchBuilderGalleryAction(websiteId);
    if (!res.ok) {
      setError("Couldn't load your photos.");
      setProperties([]);
      return;
    }
    setProperties(res.properties);
    setPropId(res.properties[0]?.id ?? "");
  }, [websiteId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const selected = (properties ?? []).find((p) => p.id === propId);

  const patchPhotos = (fn: (photos: BuilderPhoto[]) => BuilderPhoto[]) =>
    setProperties((prev) =>
      (prev ?? []).map((p) =>
        p.id === propId ? { ...p, photos: fn(p.photos) } : p,
      ),
    );

  async function upload(files: FileList | null) {
    if (!files?.length || !propId) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    setBusy(true);
    setError(null);
    try {
      const ticket = await createListingPhotoUploadUrl(propId, ext, null);
      if (!ticket.ok || !ticket.data) {
        setError(ticket.ok ? "Couldn't start the upload." : ticket.error);
        return;
      }
      const { error: upErr } = await supabase.storage
        .from("listing-photos")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (upErr) {
        setError(upErr.message || "Upload failed.");
        return;
      }
      const res = await registerListingPhotoAction(
        propId,
        ticket.data.path,
        null,
      );
      if (!res.ok || !res.data) {
        setError(res.ok ? "Couldn't save the photo." : res.error);
        return;
      }
      const added = res.data;
      patchPhotos((ps) => [...ps, { id: added.id, url: added.url }]);
      toast("Photo added — it’s now on your live site.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId: string) {
    setBusy(true);
    setError(null);
    const res = await deleteListingPhotoAction(propId, photoId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Couldn't delete the photo.");
      return;
    }
    patchPhotos((ps) => ps.filter((p) => p.id !== photoId));
    toast("Photo removed.");
    router.refresh();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit photos"
      onClick={onClose}
      style={S.backdrop}
    >
      <div onClick={(e) => e.stopPropagation()} style={S.panel}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Edit photos</div>
            <div style={S.sub}>
              Your property’s real photos (from the property). The builder
              preview shows sample content for layout.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={S.x}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {properties === null ? (
          <div style={S.state}>Loading your photos…</div>
        ) : properties.length === 0 ? (
          <div style={S.state}>
            You don’t have a property yet. Create one in{" "}
            <b>Dashboard → Properties</b>, then add photos here.
          </div>
        ) : (
          <>
            <div style={S.toolbar}>
              {properties.length > 1 && (
                <select
                  style={S.sel}
                  value={propId}
                  onChange={(e) => setPropId(e.target.value)}
                  aria-label="Property"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <span style={S.counter}>
                {selected?.photos.length ?? 0} photo
                {(selected?.photos.length ?? 0) === 1 ? "" : "s"}
              </span>
            </div>

            <div style={S.body}>
              <div style={S.grid}>
                {(selected?.photos ?? []).map((ph) => (
                  <div key={ph.id} style={S.cell}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" style={S.img} />
                    <button
                      type="button"
                      onClick={() => remove(ph.id)}
                      disabled={busy}
                      style={S.del}
                      aria-label="Delete photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  style={S.add}
                >
                  {busy ? "Working…" : "+ Add photo"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    upload(e.target.files);
                    if (e.target) e.target.value = "";
                  }}
                />
              </div>
              {error && <div style={S.err}>{error}</div>}
            </div>

            <div style={S.foot}>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={onClose} style={S.btnGhost}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    background: "rgba(6,20,14,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: "min(760px, 96vw)",
    maxHeight: "88vh",
    overflow: "hidden",
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 30px 80px -20px rgba(6,40,28,.5)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "inherit",
  },
  head: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "16px 18px",
    borderBottom: "1px solid #e8ece9",
  },
  title: { fontSize: 16, fontWeight: 700, color: "#0f1f17" },
  sub: { fontSize: 12, color: "#6b7a72", marginTop: 2, maxWidth: 560 },
  x: {
    border: "none",
    background: "transparent",
    fontSize: 16,
    cursor: "pointer",
    color: "#6b7a72",
    lineHeight: 1,
  },
  state: { padding: 28, textAlign: "center", color: "#6b7a72", fontSize: 14 },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 18px",
    borderBottom: "1px solid #f0f2f0",
  },
  sel: {
    border: "1px solid #d5ddd8",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
    color: "#0f1f17",
    fontFamily: "inherit",
    background: "#fff",
  },
  counter: { fontSize: 12, color: "#6b7a72" },
  body: { padding: 18, overflow: "auto", flex: 1 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: 10,
  },
  cell: {
    position: "relative",
    aspectRatio: "4 / 3",
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #e3e8e5",
    background: "#f4ede0",
  },
  img: { width: "100%", height: "100%", objectFit: "cover" },
  del: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "none",
    background: "rgba(0,0,0,.55)",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
    lineHeight: 1,
  },
  add: {
    aspectRatio: "4 / 3",
    borderRadius: 10,
    border: "2px dashed #b9ccc1",
    background: "#f7faf8",
    color: "#064E3B",
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
  },
  err: {
    marginTop: 12,
    fontSize: 12.5,
    color: "#b3261e",
    fontWeight: 500,
  },
  foot: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 18px",
    borderTop: "1px solid #e8ece9",
  },
  btnGhost: {
    border: "1px solid #d5ddd8",
    background: "#fff",
    color: "#31413a",
    fontWeight: 600,
    fontSize: 13,
    borderRadius: 9,
    padding: "10px 16px",
    cursor: "pointer",
  },
};
