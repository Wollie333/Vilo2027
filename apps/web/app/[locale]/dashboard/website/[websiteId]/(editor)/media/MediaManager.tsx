"use client";

import {
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  createWebsiteMediaUploadUrl,
  deleteWebsiteMediaAction,
  listWebsiteMediaAction,
  registerWebsiteMediaAction,
  saveRoomMediaOverridesAction,
  updateWebsiteMediaAltAction,
  type MediaItem,
} from "@/app/[locale]/dashboard/website/actions";
import { FormModal } from "@/components/ui/form-modal";
import { MediaLibrary } from "@/components/website/MediaLibrary";
import { createClient } from "@/lib/supabase/client";

import type { RoomGalleryRoom } from "./loadMedia";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 6 * 1024 * 1024;

function readDims(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !file.type.startsWith("image/")) {
      resolve({});
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

type View = "library" | "rooms";

export function MediaManager({
  websiteId,
  initialMedia,
  initialRooms,
}: {
  websiteId: string;
  initialMedia: MediaItem[];
  initialRooms: RoomGalleryRoom[];
}) {
  const t = useTranslations("website");
  const [view, setView] = useState<View>("library");

  return (
    <div className="vilo-cms mx-auto max-w-[1180px]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1
          className="font-display text-[20px] font-extrabold"
          style={{ color: "var(--ink)" }}
        >
          {t("mediaHeading")}
        </h1>
        <div
          className="ml-auto inline-flex overflow-hidden rounded-[10px] border"
          style={{ borderColor: "var(--line)" }}
        >
          <button
            type="button"
            onClick={() => setView("library")}
            className="px-3.5 py-1.5 text-[13px] font-semibold transition"
            style={
              view === "library"
                ? { background: "var(--primary)", color: "#fff" }
                : { color: "var(--mute)" }
            }
          >
            {t("mediaViewLibrary")}
          </button>
          <button
            type="button"
            onClick={() => setView("rooms")}
            className="px-3.5 py-1.5 text-[13px] font-semibold transition"
            style={
              view === "rooms"
                ? { background: "var(--primary)", color: "#fff" }
                : { color: "var(--mute)" }
            }
          >
            {t("mediaViewRooms")}
          </button>
        </div>
      </div>

      {view === "library" ? (
        <LibraryView websiteId={websiteId} initialMedia={initialMedia} />
      ) : (
        <RoomGalleriesView websiteId={websiteId} initialRooms={initialRooms} />
      )}
    </div>
  );
}

// ── Library view (WordPress-style grid) ───────────────────────
function LibraryView({
  websiteId,
  initialMedia,
}: {
  websiteId: string;
  initialMedia: MediaItem[];
}) {
  const t = useTranslations("website");
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>(initialMedia);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await listWebsiteMediaAction(websiteId);
    if (res.ok) setItems(res.items);
  }, [websiteId]);

  async function onPick(file: File) {
    if (!ACCEPTED.includes(file.type)) return toast.error(t("imageTypeError"));
    if (file.size > MAX_BYTES) return toast.error(t("imageSizeError"));
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ticket = await createWebsiteMediaUploadUrl(websiteId, ext);
      if (!ticket.ok) return toast.error(t("imageUploadError"));
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) return toast.error(t("imageUploadError"));
      const dims = await readDims(file);
      await registerWebsiteMediaAction(websiteId, ticket.data.path, {
        ...dims,
        size: file.size,
        mime: file.type,
      });
      await refresh();
      toast.success(t("mediaUploaded"));
    } finally {
      setUploading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.alt ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const open = openPath ? items.find((i) => i.path === openPath) : null;

  return (
    <section
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border bg-white px-3 py-2"
          style={{ borderColor: "var(--line)" }}
        >
          <Search className="h-4 w-4 shrink-0 text-brand-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("mediaSearchAll")}
            className="w-full bg-transparent text-sm text-brand-ink outline-none"
          />
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="btn btn-primary btn-sm"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {t("mediaUploadNew")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
            e.target.value = "";
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div
          className="flex h-48 flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed text-center text-sm text-brand-mute"
          style={{ borderColor: "var(--line)" }}
        >
          <ImagePlus className="h-6 w-6 opacity-50" />
          {query.trim() ? t("mediaNoResults") : t("mediaEmpty")}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {filtered.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => setOpenPath(item.path)}
              title={item.name}
              className="group relative aspect-square overflow-hidden rounded-[10px] border transition hover:border-brand-primary"
              style={{ borderColor: "var(--line)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt ?? ""}
                className="h-full w-full object-cover"
              />
              {!item.alt ? (
                <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t("mediaNoAlt")}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {open ? (
        <MediaDetailModal
          websiteId={websiteId}
          item={open}
          onClose={() => setOpenPath(null)}
          onSaved={(alt) => {
            setItems((prev) =>
              prev.map((i) => (i.path === open.path ? { ...i, alt } : i)),
            );
          }}
          onDeleted={() => {
            setItems((prev) => prev.filter((i) => i.path !== open.path));
            setOpenPath(null);
          }}
        />
      ) : null}
    </section>
  );
}

function MediaDetailModal({
  websiteId,
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  websiteId: string;
  item: MediaItem;
  onClose: () => void;
  onSaved: (alt: string | null) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("website");
  const [alt, setAlt] = useState(item.alt ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateWebsiteMediaAltAction(websiteId, item.path, alt);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      onSaved(alt.trim() || null);
      toast.success(t("mediaAltSaved"));
      onClose();
    });
  }
  function remove() {
    if (!window.confirm(t("mediaDeleteConfirm"))) return;
    start(async () => {
      const res = await deleteWebsiteMediaAction(websiteId, item.path);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("mediaDeleted"));
      onDeleted();
    });
  }

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("mediaDetailsTitle")}
      description={item.name}
      size="lg"
    >
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
        <div
          className="overflow-hidden rounded-[12px] border"
          style={{ borderColor: "var(--line)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.alt ?? ""}
            className="max-h-[50vh] w-full object-contain"
          />
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[13px] font-semibold text-brand-ink">
              {t("mediaAlt")}
            </span>
            <textarea
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder={t("mediaAltPlaceholder")}
              className="mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
            />
            <span className="mt-1 block text-[11.5px] text-brand-mute">
              {t("mediaAltHint")}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("mediaAltSave")}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="btn btn-sm"
              style={{ color: "#dc2626" }}
            >
              <Trash2 className="h-4 w-4" />
              {t("mediaDelete")}
            </button>
          </div>
        </div>
      </div>
    </FormModal>
  );
}

// ── Room galleries view (per-room hide/add) ───────────────────
type WorkingRoom = RoomGalleryRoom;

function RoomGalleriesView({
  websiteId,
  initialRooms,
}: {
  websiteId: string;
  initialRooms: RoomGalleryRoom[];
}) {
  const t = useTranslations("website");
  const [rooms, setRooms] = useState<WorkingRoom[]>(initialRooms);
  const [idx, setIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, start] = useTransition();

  if (rooms.length === 0) {
    return (
      <section
        className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center text-sm text-brand-mute"
        style={{ borderColor: "var(--line)" }}
      >
        <ImagePlus className="h-6 w-6 opacity-50" />
        {t("mediaRoomNoRooms")}
      </section>
    );
  }

  const room = rooms[idx];
  const hidden = new Set(room.overrides.hidden);

  const patch = (next: Partial<WorkingRoom["overrides"]>) =>
    setRooms((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, overrides: { ...r.overrides, ...next } } : r,
      ),
    );

  const toggleHidden = (photoId: string) => {
    const set = new Set(room.overrides.hidden);
    if (set.has(photoId)) set.delete(photoId);
    else set.add(photoId);
    patch({ hidden: [...set] });
  };

  const removeExtra = (path: string) =>
    patch({ extra: room.overrides.extra.filter((e) => e.path !== path) });

  function save() {
    start(async () => {
      const res = await saveRoomMediaOverridesAction(
        websiteId,
        room.roomId,
        room.overrides,
      );
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("mediaRoomSaved"));
    });
  }

  const shownCount =
    room.photos.filter((p) => !hidden.has(p.id)).length +
    room.overrides.extra.length;

  return (
    <section
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-semibold text-brand-ink">
          {t("mediaRoomPick")}
        </label>
        <select
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
        >
          {rooms.map((r, i) => (
            <option key={r.roomId} value={i}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="text-[12.5px] text-brand-mute">
          {t("mediaRoomShownCount", { count: shownCount })}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn btn-primary btn-sm ml-auto"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("mediaRoomSave")}
        </button>
      </div>

      <p className="mb-3 text-[12.5px] text-brand-mute">{t("mediaRoomHelp")}</p>

      {/* Room's own photos — toggle show/hide */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {room.photos.map((p) => {
          const isHidden = hidden.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleHidden(p.id)}
              className="group relative aspect-square overflow-hidden rounded-[10px] border transition"
              style={{
                borderColor: isHidden ? "var(--line)" : "var(--primary)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? ""}
                className="h-full w-full object-cover transition"
                style={
                  isHidden
                    ? { opacity: 0.35, filter: "grayscale(1)" }
                    : undefined
                }
              />
              <span
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-sm"
                style={{ background: isHidden ? "#6b7280" : "var(--primary)" }}
              >
                {isHidden ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </span>
              {isHidden ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t("mediaRoomHidden")}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Extra (added) images */}
        {room.overrides.extra.map((e) => (
          <div
            key={e.path}
            className="group relative aspect-square overflow-hidden rounded-[10px] border"
            style={{ borderColor: "var(--primary)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(e.path)}
              alt={e.alt ?? ""}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-1 left-1 rounded bg-brand-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {t("mediaRoomAdded")}
            </span>
            <button
              type="button"
              onClick={() => removeExtra(e.path)}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm hover:bg-red-50"
              aria-label={t("mediaRoomRemove")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Add image tile */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed text-[12px] font-semibold text-brand-mute transition hover:border-brand-primary hover:text-brand-primary"
          style={{ borderColor: "var(--line)" }}
        >
          <Plus className="h-5 w-5" />
          {t("mediaRoomAddImage")}
        </button>
      </div>

      <MediaLibrary
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        websiteId={websiteId}
        onSelectItem={(item) => {
          if (room.overrides.extra.some((e) => e.path === item.path)) return;
          patch({
            extra: [
              ...room.overrides.extra,
              { path: item.path, alt: item.alt ?? undefined },
            ],
          });
        }}
      />
    </section>
  );
}

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
function mediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return SUPA
    ? `${SUPA}/storage/v1/object/public/website-assets/${path}`
    : path;
}
