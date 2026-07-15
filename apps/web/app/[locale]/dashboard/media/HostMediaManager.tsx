"use client";

import { ImagePlus, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createListingPhotoUploadUrl,
  deleteListingPhotoAction,
  registerListingPhotoAction,
  setListingPhotoCaptionAction,
} from "@/app/[locale]/dashboard/properties/[id]/edit/actions";
import {
  createWebsiteMediaUploadUrl,
  deleteWebsiteMediaAction,
  registerWebsiteMediaAction,
  updateWebsiteMediaAltAction,
} from "@/app/[locale]/dashboard/website/actions";
import { FormModal } from "@/components/ui/form-modal";
import { createClient } from "@/lib/supabase/client";

import type {
  HostListingMedia,
  HostMediaData,
  HostMediaItem,
} from "./loadHostMedia";

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

function validate(file: File): boolean {
  if (!ACCEPTED.includes(file.type)) {
    toast.error("Use a PNG, JPG, WebP or SVG image.");
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast.error("Images must be under 6 MB.");
    return false;
  }
  return true;
}

type View = "website" | "listings";

export function HostMediaManager({ data }: { data: HostMediaData }) {
  const [view, setView] = useState<View>("website");

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Media
          </h1>
          <p className="mt-0.5 text-sm text-brand-mute">
            Manage every image across your websites, listings and rooms in one
            place.
          </p>
        </div>
        <div className="ml-auto inline-flex overflow-hidden rounded-[10px] border border-brand-line">
          <Seg on={view === "website"} onClick={() => setView("website")}>
            Website media
          </Seg>
          <Seg on={view === "listings"} onClick={() => setView("listings")}>
            Listings &amp; rooms
          </Seg>
        </div>
      </div>

      {view === "website" ? (
        <WebsiteMediaView data={data} />
      ) : (
        <ListingsView listings={data.listings} />
      )}
    </div>
  );
}

function Seg({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 text-[13px] font-semibold transition ${
        on
          ? "bg-brand-primary text-white"
          : "text-brand-mute hover:bg-brand-light"
      }`}
    >
      {children}
    </button>
  );
}

// ── Website media (all sites) ─────────────────────────────────
function WebsiteMediaView({ data }: { data: HostMediaData }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<HostMediaItem[]>(data.websiteMedia);
  const [site, setSite] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);

  async function onPick(file: File) {
    if (!validate(file)) return;
    if (!data.primaryWebsiteId) {
      toast.error("Create a website first to add website media.");
      return;
    }
    const target = site !== "all" ? site : data.primaryWebsiteId;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ticket = await createWebsiteMediaUploadUrl(target, ext);
      if (!ticket.ok) return void toast.error("Upload failed. Try again.");
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) return void toast.error("Upload failed. Try again.");
      const dims = await readDims(file);
      await registerWebsiteMediaAction(target, ticket.data.path, {
        ...dims,
        size: file.size,
        mime: file.type,
      });
      toast.success("Image uploaded.");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (site !== "all" && i.websiteId !== site) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.alt ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, site, query]);

  const open = openPath ? items.find((i) => i.path === openPath) : null;

  return (
    <section className="rounded-2xl border border-brand-line bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {data.websites.length > 1 ? (
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          >
            <option value="all">All websites</option>
            {data.websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-brand-line bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-brand-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or alt text…"
            className="w-full bg-transparent text-sm text-brand-ink outline-none"
          />
        </div>
        <button
          type="button"
          disabled={uploading || !data.primaryWebsiteId}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload
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
        <Empty
          label={
            query.trim()
              ? "No images match your search."
              : "No website media yet. Upload your first image."
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {filtered.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => setOpenPath(item.path)}
              title={item.name}
              className="group relative aspect-square overflow-hidden rounded-[10px] border border-brand-line transition hover:border-brand-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.alt ?? ""}
                className="h-full w-full object-cover"
              />
              {data.websites.length > 1 ? (
                <span className="absolute right-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {item.siteLabel}
                </span>
              ) : null}
              {!item.alt ? (
                <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  No alt
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {open ? (
        <WebsiteMediaDetail
          item={open}
          onClose={() => setOpenPath(null)}
          onSaved={(alt) =>
            setItems((prev) =>
              prev.map((i) => (i.path === open.path ? { ...i, alt } : i)),
            )
          }
          onDeleted={() => {
            setItems((prev) => prev.filter((i) => i.path !== open.path));
            setOpenPath(null);
          }}
        />
      ) : null}
    </section>
  );
}

function WebsiteMediaDetail({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: HostMediaItem;
  onClose: () => void;
  onSaved: (alt: string | null) => void;
  onDeleted: () => void;
}) {
  const [alt, setAlt] = useState(item.alt ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateWebsiteMediaAltAction(
        item.websiteId,
        item.path,
        alt,
      );
      if (!res.ok) {
        toast.error("Couldn't save. Try again.");
        return;
      }
      onSaved(alt.trim() || null);
      toast.success("Alt text saved.");
      onClose();
    });
  }
  function remove() {
    // Honest warning: deleting the object does NOT update pages/sections that
    // reference it — those would show a broken image until the host replaces it.
    if (
      !window.confirm(
        "Delete this image? If it's used on a page, that page will show a broken image until you replace it there.",
      )
    )
      return;
    start(async () => {
      const res = await deleteWebsiteMediaAction(item.websiteId, item.path);
      if (!res.ok) {
        toast.error("Couldn't delete. Try again.");
        return;
      }
      toast.success("Image deleted.");
      onDeleted();
    });
  }

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Image details"
      description={item.name}
      size="lg"
    >
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-[12px] border border-brand-line">
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
              Alt text
            </span>
            <textarea
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Describe the image"
              className="mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
            />
            <span className="mt-1 block text-[11.5px] text-brand-mute">
              Describes the image for SEO and screen readers.
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save alt text
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </FormModal>
  );
}

// ── Listings & rooms photos (directory) ───────────────────────
function ListingsView({ listings }: { listings: HostListingMedia[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [idx, setIdx] = useState(0);
  // "" = listing-level photos; otherwise a room id.
  const [scope, setScope] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  if (listings.length === 0) {
    return <Empty label="You don't have any listings yet." />;
  }

  const listing = listings[idx];
  const roomId = scope || null;
  const photos = listing.photos.filter((p) => (p.roomId ?? null) === roomId);
  const openPhoto = openPhotoId
    ? photos.find((p) => p.id === openPhotoId)
    : null;

  async function onPick(file: File) {
    if (!validate(file)) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ticket = await createListingPhotoUploadUrl(listing.id, ext, roomId);
      if (!ticket.ok || !ticket.data)
        return void toast.error(ticket.ok ? "Upload failed." : ticket.error);
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("listing-photos")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) return void toast.error("Upload failed. Try again.");
      const res = await registerListingPhotoAction(
        listing.id,
        ticket.data.path,
        roomId,
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success("Photo added.");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-line bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-semibold text-brand-ink">
          Listing
        </label>
        <select
          value={idx}
          onChange={(e) => {
            setIdx(Number(e.target.value));
            setScope("");
          }}
          className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
        >
          {listings.map((l, i) => (
            <option key={l.id} value={i}>
              {l.name}
            </option>
          ))}
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
        >
          <option value="">Listing photos (directory)</option>
          {listing.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              Room · {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add photo
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

      <p className="mb-3 text-[12.5px] text-brand-mute">
        {roomId
          ? "Photos for this room. They appear on the room and its detail page."
          : "Photos for the whole listing — these show in the public directory and on your website."}
      </p>

      {photos.length === 0 ? (
        <Empty label="No photos here yet. Add your first one." />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenPhotoId(p.id)}
              className="group relative aspect-square overflow-hidden rounded-[10px] border border-brand-line transition hover:border-brand-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? ""}
                className="h-full w-full object-cover"
              />
              {!p.caption ? (
                <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  No alt
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {openPhoto ? (
        <ListingPhotoDetail
          listingId={listing.id}
          photo={openPhoto}
          onClose={() => setOpenPhotoId(null)}
        />
      ) : null}
    </section>
  );
}

function ListingPhotoDetail({
  listingId,
  photo,
  onClose,
}: {
  listingId: string;
  photo: { id: string; url: string; caption: string | null };
  onClose: () => void;
}) {
  const router = useRouter();
  const [alt, setAlt] = useState(photo.caption ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await setListingPhotoCaptionAction(listingId, photo.id, alt);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Alt text saved.");
      router.refresh();
      onClose();
    });
  }
  function remove() {
    if (!window.confirm("Remove this photo from the listing?")) return;
    start(async () => {
      const res = await deleteListingPhotoAction(listingId, photo.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Photo removed.");
      router.refresh();
      onClose();
    });
  }

  return (
    <FormModal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Image details"
      description="Alt text describes the photo for SEO and screen readers, and is used as its caption."
      size="lg"
    >
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-[12px] border border-brand-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption ?? ""}
            className="max-h-[50vh] w-full object-contain"
          />
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[13px] font-semibold text-brand-ink">
              Alt text
            </span>
            <textarea
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Describe the photo"
              className="mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save alt text
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </FormModal>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-brand-line text-center text-sm text-brand-mute">
      <ImagePlus className="h-6 w-6 opacity-50" />
      {label}
    </div>
  );
}
