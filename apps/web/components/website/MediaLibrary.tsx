"use client";

import {
  Check,
  ImagePlus,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  createWebsiteMediaUploadUrl,
  deleteWebsiteMediaAction,
  listWebsiteMediaAction,
  registerWebsiteMediaAction,
  type MediaItem,
} from "@/app/[locale]/dashboard/website/actions";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 6 * 1024 * 1024;

/** Read intrinsic dimensions of an image File (best-effort; resolves nulls on error). */
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

/**
 * Reusable Media Library (Phase 0B). Browses every asset already uploaded under a
 * site's `website-assets/{websiteId}/` folder, supports a fresh upload, alt-text
 * editing, and delete. `onSelect(path)` hands the chosen storage path back to the
 * caller (an image field, the logo picker, blog cover, OG image…). `onSelectItem`
 * is the richer variant — it hands back the whole media row (url + alt) for
 * callers that need more than the path (e.g. the rich-text editor inserting an
 * <img> with its stored alt). When provided, it takes precedence over onSelect.
 */
export function MediaLibrary({
  open,
  onOpenChange,
  websiteId,
  onSelect,
  onSelectItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  onSelect?: (path: string) => void;
  onSelectItem?: (item: MediaItem) => void;
}) {
  const t = useTranslations("website");
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listWebsiteMediaAction(websiteId);
      if (res.ok) setItems(res.items);
      else toast.error(t("mediaLoadError"));
    } finally {
      setLoading(false);
    }
  }, [websiteId, t]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
      void refresh();
    }
  }, [open, refresh]);

  async function onPick(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("imageTypeError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("imageSizeError"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ticket = await createWebsiteMediaUploadUrl(websiteId, ext);
      if (!ticket.ok) {
        toast.error(t("imageUploadError"));
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) {
        toast.error(t("imageUploadError"));
        return;
      }
      const dims = await readDims(file);
      await registerWebsiteMediaAction(websiteId, ticket.data.path, {
        ...dims,
        size: file.size,
        mime: file.type,
      });
      await refresh();
      setSelected(ticket.data.path);
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(path: string) {
    if (!window.confirm(t("mediaDeleteConfirm"))) return;
    const res = await deleteWebsiteMediaAction(websiteId, path);
    if (res.ok) {
      if (selected === path) setSelected(null);
      setItems((prev) => prev.filter((i) => i.path !== path));
      toast.success(t("mediaDeleted"));
    }
  }

  function confirmSelect() {
    if (!selected) return;
    if (onSelectItem) {
      const item = items.find((i) => i.path === selected);
      if (item) onSelectItem(item);
    } else {
      onSelect?.(selected);
    }
    onOpenChange(false);
  }

  const filtered = query.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : items;

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={t("mediaLibrary")}
      description={t("mediaLibraryDesc")}
      size="lg"
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-[10px] border border-brand-line bg-white px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-brand-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("mediaSearch")}
              className="w-full bg-transparent text-sm text-brand-ink outline-none"
            />
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
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

        {/* Grid */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-brand-mute">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-brand-line text-center text-sm text-brand-mute">
            <ImagePlus className="h-6 w-6 opacity-50" />
            {query.trim() ? t("mediaNoResults") : t("mediaEmpty")}
          </div>
        ) : (
          <div className="grid max-h-[46vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {filtered.map((item) => {
              const isSel = selected === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => setSelected(item.path)}
                  className={`group relative aspect-square overflow-hidden rounded-[10px] border-2 transition ${
                    isSel
                      ? "border-brand-primary ring-2 ring-brand-primary/30"
                      : "border-transparent hover:border-brand-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.alt ?? ""}
                    className="h-full w-full object-cover"
                  />
                  {isSel ? (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : null}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDelete(item.path);
                    }}
                    className="absolute left-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm hover:bg-red-50 group-hover:flex"
                    aria-label={t("mediaDelete")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <FormModalFooter>
        <FormModalCancel>{t("cancel")}</FormModalCancel>
        <button
          type="button"
          disabled={!selected}
          onClick={confirmSelect}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {t("mediaSelect")}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
