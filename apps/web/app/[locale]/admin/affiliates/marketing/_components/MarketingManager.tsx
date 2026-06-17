"use client";

import {
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
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
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { createClient } from "@/lib/supabase/client";

import {
  createMarketingUploadUrlAction,
  deleteMarketingAsset,
  type MarketingCategory,
  toggleMarketingAsset,
  upsertMarketingAsset,
} from "../actions";

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

export function MarketingManager({ assets }: { assets: MarketingAsset[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm("banner"));
  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25 MB.");
      return;
    }
    setUploading(true);
    try {
      const ticket = await createMarketingUploadUrlAction({
        fileName: file.name,
        contentType: file.type,
      });
      if (!ticket.ok) {
        toast.error(ticket.error);
        return;
      }
      const { error } = await supabase.storage
        .from("marketing-assets")
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || undefined,
        });
      if (error) {
        toast.error(error.message || "Upload failed.");
        return;
      }
      let width: number | null = null;
      let height: number | null = null;
      if (file.type.startsWith("image/")) {
        const dims = await readImageDimensions(file).catch(() => null);
        if (dims) {
          width = dims.w;
          height = dims.h;
        }
      }
      setForm((f) => ({
        ...f,
        fileUrl: ticket.publicUrl,
        filePath: ticket.path,
        mimeType: file.type,
        width,
        height,
      }));
      toast.success("File uploaded.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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
    <div className="space-y-9">
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
                <span className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand-mute">
                  {rows.length}
                </span>
              </div>
              <button
                onClick={() => openCreate(cat)}
                className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <p className="mt-0.5 text-[12.5px] text-brand-mute">{meta.blurb}</p>

            {rows.length === 0 ? (
              <div className="mt-3 rounded-card border border-dashed border-brand-line bg-[#FAFCFB] px-4 py-6 text-center text-[12.5px] text-brand-mute">
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
        description="An asset can carry a file, a link, text — or any combination."
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
                className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm"
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
                className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm"
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
              className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm"
              placeholder="Internal/affiliate-facing note"
            />
          </Labeled>

          <Labeled label="Text content (email body, caption, prompt, excerpt)">
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={5}
              className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm"
              placeholder="The copy-paste text affiliates use."
            />
          </Labeled>

          <Labeled label="Link URL (optional)">
            <input
              value={form.linkUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, linkUrl: e.target.value }))
              }
              className="w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm"
              placeholder="https://… (video, blog post, or CTA)"
            />
          </Labeled>

          <Labeled label="File (optional — banner image, video, etc.)">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload file"}
              </button>
              {form.fileUrl ? (
                <a
                  href={form.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-primary hover:underline"
                >
                  View uploaded file <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <input ref={fileRef} type="file" hidden onChange={onPickFile} />
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
            disabled={saving || uploading || !form.title.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-pill bg-brand-primary px-5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
          >
            {saving ? "Saving…" : form.id ? "Save changes" : "Add asset"}
          </button>
        </FormModalFooter>
      </FormModal>
    </div>
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
      className={`flex flex-col overflow-hidden rounded-[14px] border bg-white shadow-card ${
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
            <span className="shrink-0 rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-mute">
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
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-2.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
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
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}

function readImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
