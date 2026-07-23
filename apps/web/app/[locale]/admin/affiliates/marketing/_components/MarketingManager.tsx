"use client";

import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  type LucideIcon,
  MessageSquareQuote,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createLibraryUploadUrlAction,
  deleteLibraryImage,
} from "@/app/[locale]/admin/library/actions";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { createClient } from "@/lib/supabase/client";

import {
  deleteMarketingAsset,
  type MarketingCategory,
  toggleMarketingAsset,
  upsertMarketingAsset,
} from "../actions";

const BUCKET = "marketing-assets";

export type LibraryImage = {
  path: string;
  url: string;
  sizeBytes: number | null;
  mime: string | null;
  createdAt: string | null;
  inUse: boolean;
};

export type MarketingAsset = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  body: string | null;
  link_url: string | null;
  file_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_active: boolean;
};

const CATEGORY_META: Record<
  MarketingCategory,
  { label: string; icon: LucideIcon; blurb: string }
> = {
  banner: {
    label: "Banners",
    icon: ImageIcon,
    blurb: "Image banners affiliates download or embed.",
  },
  social: {
    label: "Social posts",
    icon: MessageSquareQuote,
    blurb: "Ready-to-paste captions for social channels.",
  },
  email: {
    label: "Email templates",
    icon: Mail,
    blurb: "A subject (title) and body affiliates can copy.",
  },
  prompt: {
    label: "AI prompts",
    icon: Sparkles,
    blurb: "Prompts affiliates paste into an AI writer.",
  },
  video: {
    label: "Videos",
    icon: Video,
    blurb: "Uploaded or linked videos to share.",
  },
  blog: {
    label: "Blogs",
    icon: FileText,
    blurb: "Articles to share — a link plus a short excerpt.",
  },
};

const ORDER: MarketingCategory[] = [
  "banner",
  "social",
  "email",
  "prompt",
  "video",
  "blog",
];

type FormState = {
  id: string | null;
  category: MarketingCategory;
  title: string;
  description: string;
  body: string;
  linkUrl: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  isActive: boolean;
};

const emptyForm = (category: MarketingCategory): FormState => ({
  id: null,
  category,
  title: "",
  description: "",
  body: "",
  linkUrl: "",
  fileUrl: "",
  filePath: "",
  mimeType: "",
  width: null,
  height: null,
  isActive: true,
});

function humanSize(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function readImageDimensions(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("bad image"));
    img.src = url;
  });
}

export function MarketingManager({
  assets,
  library,
}: {
  assets: MarketingAsset[];
  library: LibraryImage[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [lib, setLib] = useState<LibraryImage[]>(library);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm("banner"));
  const [saving, startSaving] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const byCategory = (c: MarketingCategory) =>
    assets
      .filter((a) => a.category === c)
      .sort((a, b) => a.sort_order - b.sort_order);

  function openCreate(category: MarketingCategory) {
    setForm(emptyForm(category));
    setOpen(true);
  }
  function openEdit(a: MarketingAsset) {
    setForm({
      id: a.id,
      category: (ORDER.includes(a.category as MarketingCategory)
        ? a.category
        : "banner") as MarketingCategory,
      title: a.title,
      description: a.description ?? "",
      body: a.body ?? "",
      linkUrl: a.link_url ?? "",
      fileUrl: a.file_url ?? "",
      filePath: a.file_path ?? "",
      mimeType: a.mime_type ?? "",
      width: a.width,
      height: a.height,
      isActive: a.is_active,
    });
    setOpen(true);
  }

  // Assign a library image to the asset being edited (no upload here — the admin
  // uploads to the library above, then picks from it).
  function pickImage(img: LibraryImage) {
    setForm((f) => ({
      ...f,
      fileUrl: img.url,
      filePath: img.path,
      mimeType: img.mime ?? "image/*",
      width: null,
      height: null,
    }));
    readImageDimensions(img.url)
      .then((d) =>
        setForm((f) =>
          f.filePath === img.path ? { ...f, width: d.w, height: d.h } : f,
        ),
      )
      .catch(() => {});
    setPickerOpen(false);
  }

  function save() {
    startSaving(async () => {
      const res = await upsertMarketingAsset({
        id: form.id,
        category: form.category,
        title: form.title,
        description: form.description || null,
        body: form.body || null,
        linkUrl: form.linkUrl || "",
        filePath: form.filePath || null,
        fileUrl: form.fileUrl || "",
        mimeType: form.mimeType || null,
        width: form.width,
        height: form.height,
        sortOrder: 0,
        isActive: form.isActive,
      });
      if (res.ok) {
        toast.success(form.id ? "Asset updated." : "Asset added.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(a: MarketingAsset) {
    startSaving(async () => {
      const res = await deleteMarketingAsset(a.id);
      if (res.ok) {
        toast.success("Asset removed.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function toggle(a: MarketingAsset) {
    startSaving(async () => {
      const res = await toggleMarketingAsset(a.id, !a.is_active);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-8">
      <WieloMediaLibrary
        images={lib}
        supabase={supabase}
        onUploaded={(imgs) => setLib((prev) => [...imgs, ...prev])}
        onDeleted={(path) =>
          setLib((prev) => prev.filter((i) => i.path !== path))
        }
      />

      {/* SHARED WITH AFFILIATES — the categorized assets partners actually see. */}
      <div>
        <div className="smallcaps">Shared with affiliates</div>
        <p className="mt-1 text-[12.5px] text-brand-mute">
          Only what you publish here shows in a partner&apos;s marketing
          library, with their referral link baked in. Images are assigned from
          the media library above.
        </p>
      </div>

      {ORDER.map((cat) => {
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        const rows = byCategory(cat);
        return (
          <section key={cat}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-[18px] w-[18px] text-brand-primary" />
                <h2 className="font-display text-[16px] font-bold text-brand-ink">
                  {meta.label}
                </h2>
                <span className="tag gray">
                  <span className="d" />
                  {rows.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => openCreate(cat)}
                className="btn-sec h-9"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <p className="mt-0.5 text-[12.5px] text-brand-mute">{meta.blurb}</p>

            {rows.length === 0 ? (
              <div className="am-card mt-3 border-dashed px-4 py-6 text-center text-[12.5px] text-brand-mute">
                Nothing here yet — add your first {meta.label.toLowerCase()}.
              </div>
            ) : (
              <div className="mt-3 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    onEdit={() => openEdit(a)}
                    onDelete={() => remove(a)}
                    onToggle={() => toggle(a)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Create / edit modal */}
      <FormModal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={form.id ? "Edit asset" : "Add marketing asset"}
        description="Assign an image from the library, add a link, text — or any combination."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Type">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as MarketingCategory,
                  }))
                }
                className="fld"
              >
                {ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Title / subject">
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="fld"
                placeholder="e.g. Keep 100% of every booking"
              />
            </Labeled>
          </div>

          <Labeled label="Short description (optional)">
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="fld"
              placeholder="Internal/affiliate-facing note"
            />
          </Labeled>

          <Labeled label="Text content (email body, caption, prompt, excerpt)">
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={5}
              className="fld"
            />
          </Labeled>

          <Labeled label="Link URL (optional)">
            <input
              value={form.linkUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, linkUrl: e.target.value }))
              }
              className="fld"
              placeholder="https://… (video, blog post, or CTA)"
            />
          </Labeled>

          <Labeled label="Image (assigned from the media library)">
            <div className="flex flex-wrap items-center gap-3">
              {form.fileUrl ? (
                <span className="relative h-16 w-24 overflow-hidden rounded-[10px] border border-brand-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.fileUrl}
                    alt="Selected"
                    className="h-full w-full object-cover"
                  />
                </span>
              ) : (
                <span className="flex h-16 w-24 items-center justify-center rounded-[10px] border border-dashed border-brand-line text-brand-mute">
                  <ImageIcon className="h-5 w-5" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="btn-sec h-9"
              >
                {form.fileUrl ? "Change image" : "Choose from library"}
              </button>
              {form.fileUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      fileUrl: "",
                      filePath: "",
                      mimeType: "",
                      width: null,
                      height: null,
                    }))
                  }
                  className="btn-ghost h-9"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </Labeled>

          <label className="flex items-center gap-2 text-sm text-brand-ink">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
              className="h-4 w-4 rounded border-brand-line text-brand-primary"
            />
            Published (visible to affiliates)
          </label>
        </div>

        <FormModalFooter>
          <FormModalCancel disabled={saving}>Cancel</FormModalCancel>
          <button
            type="button"
            onClick={save}
            disabled={saving || !form.title.trim()}
            className="btn-pri h-10"
          >
            {saving ? "Saving…" : form.id ? "Save changes" : "Add asset"}
          </button>
        </FormModalFooter>
      </FormModal>

      {/* Library picker for the asset image */}
      <FormModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        size="lg"
        title="Choose an image"
        description="Pick from the Wielo media library. Upload new images in the library above."
      >
        {lib.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-brand-mute">
            The library is empty — upload images first.
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {lib.map((img) => (
              <button
                key={img.path}
                type="button"
                onClick={() => pickImage(img)}
                title={img.path}
                className={`group relative aspect-square overflow-hidden rounded-[10px] border transition hover:border-brand-primary ${
                  form.filePath === img.path
                    ? "border-brand-primary ring-2 ring-brand-primary/30"
                    : "border-brand-line"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.path}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </FormModal>
    </div>
  );
}

// ── Wielo media library (admin-only image store) ──────────────────────────────
function WieloMediaLibrary({
  images,
  supabase,
  onUploaded,
  onDeleted,
}: {
  images: LibraryImage[];
  supabase: ReturnType<typeof createClient>;
  onUploaded: (imgs: LibraryImage[]) => void;
  onDeleted: (path: string) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, start] = useTransition();
  const [q, setQ] = useState("");

  const shown = q.trim()
    ? images.filter((i) =>
        i.path.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : images;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    const added: LibraryImage[] = [];
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} is over 25 MB — skipped.`);
          continue;
        }
        const ticket = await createLibraryUploadUrlAction({
          fileName: file.name,
        });
        if (!ticket.ok) {
          toast.error(ticket.error);
          continue;
        }
        const { error } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: file.type || undefined,
          });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }
        added.push({
          path: ticket.path,
          url: ticket.publicUrl,
          sizeBytes: file.size,
          mime: file.type || null,
          createdAt: null,
          inUse: false,
        });
      }
      if (added.length) {
        onUploaded(added);
        toast.success(
          `Uploaded ${added.length} image${added.length === 1 ? "" : "s"}.`,
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Image URL copied."),
      () => toast.error("Couldn't copy."),
    );
  }

  function remove(img: LibraryImage) {
    if (img.inUse) {
      toast.error("This image backs a marketing asset — remove that first.");
      return;
    }
    if (!confirm("Delete this image? This can't be undone.")) return;
    start(async () => {
      const r = await deleteLibraryImage({ path: img.path });
      if (r.ok) {
        onDeleted(img.path);
        toast.success("Image deleted.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="am-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-line px-5 py-3.5">
        <div>
          <div className="smallcaps">Wielo media library</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Every image the platform uses. Admin-only — affiliates never browse
            this; they only see what you assign into the assets below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-pri h-9"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload images
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onPick}
        />
      </div>

      <div className="p-5">
        {images.length > 0 ? (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by file name…"
            className="fld mb-4 max-w-sm"
          />
        ) : null}

        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-brand-line py-12 text-center text-sm text-brand-mute">
            <ImagePlus className="h-6 w-6 opacity-50" />
            {images.length === 0
              ? "No images yet. Upload the first one to start your Wielo media library."
              : "No images match that search."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((img) => (
              <div
                key={img.path}
                className="group relative overflow-hidden rounded-[12px] border border-brand-line"
              >
                <div className="relative aspect-[4/3] bg-brand-light/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.path}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {img.inUse ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-brand-ink/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Lock className="h-3 w-3" /> In use
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium text-brand-ink">
                      {img.path.replace(/^\d+-[a-z0-9]+-/, "")}
                    </div>
                    <div className="text-[10px] text-brand-mute">
                      {humanSize(img.sizeBytes)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => copyUrl(img.url)}
                      aria-label="Copy image URL"
                      title="Copy URL"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(img)}
                      disabled={busy || img.inUse}
                      aria-label="Delete image"
                      title={img.inUse ? "In use — can't delete" : "Delete"}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-mute transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AssetCard({
  asset,
  onEdit,
  onDelete,
  onToggle,
}: {
  asset: MarketingAsset;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const isImage = (asset.mime_type ?? "").startsWith("image/");
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[14px] border bg-white shadow-[0_1px_2px_rgba(6,78,59,0.05)] ${
        asset.is_active
          ? "border-brand-line"
          : "border-dashed border-brand-line opacity-70"
      }`}
    >
      {isImage && asset.file_url ? (
        <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-brand-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.file_url}
            alt={asset.title}
            className="h-full w-full object-contain"
          />
        </div>
      ) : asset.body ? (
        <p className="line-clamp-4 whitespace-pre-wrap bg-[#FAFCFB] p-3 text-[12px] leading-relaxed text-brand-ink">
          {asset.body}
        </p>
      ) : null}

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[14px] font-semibold leading-snug text-brand-ink">
            {asset.title}
          </h3>
          {!asset.is_active ? (
            <span className="tag gray shrink-0">
              <span className="d" />
              Hidden
            </span>
          ) : null}
        </div>
        {asset.description ? (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-brand-mute">
            {asset.description}
          </p>
        ) : null}
        {asset.link_url ? (
          <a
            href={asset.link_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 truncate text-[11.5px] font-medium text-brand-primary hover:underline"
          >
            {asset.link_url.replace(/^https?:\/\//, "")}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : null}

        <div className="mt-auto flex items-center gap-1.5 pt-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-2.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onToggle}
            title={asset.is_active ? "Hide from affiliates" : "Publish"}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-2.5 text-[12px] font-semibold text-brand-mute transition hover:bg-brand-light"
          >
            {asset.is_active ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-brand-line bg-white text-brand-mute transition hover:bg-rose-50 hover:text-status-cancelled"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flabel">{label}</span>
      {children}
    </label>
  );
}
