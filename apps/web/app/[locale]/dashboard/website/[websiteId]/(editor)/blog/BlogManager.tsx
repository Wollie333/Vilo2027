"use client";

import {
  Images,
  Info,
  List,
  ListChecks,
  Loader2,
  Megaphone,
  MoreHorizontal,
  PenLine,
  Pencil,
  Plus,
  Star,
  SquareDashed,
  Tag,
  Trash2,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  createBlogPostAction,
  deleteBlogPostAction,
  saveBlogAuthorsAction,
  saveBlogCategoriesAction,
  setBlogFeaturedAction,
} from "@/app/[locale]/dashboard/website/actions";
import { modal } from "@/components/ui/modal-host";
import { websiteAssetUrl } from "@/lib/website/assets";

import type {
  BlogAuthorRow,
  BlogCategoryStat,
  BlogPostRow,
} from "./loadBlogEditor";
import {
  ImageField,
  ItemListEditor,
  TextArea,
  TextField,
} from "../pages/[pageId]/_components/fields";

type Filter = "all" | "published" | "draft" | "scheduled";
const FILTERS: Filter[] = ["all", "published", "draft", "scheduled"];
const GRID = "minmax(0,1fr) 120px 110px 130px 92px";
const CAT_CHIP = {
  background: "#F0FDF4",
  borderColor: "#D7EEE2",
  color: "#3A7A5E",
} as const;

// Starting points for the New-post modal. All seed a blank draft today (the
// template content seeding is a later enhancement); copy mirrors the mockup.
const TEMPLATES: { icon: typeof List; name: string; desc: string }[] = [
  { icon: SquareDashed, name: "Blank post", desc: "A clean page to write" },
  { icon: ListChecks, name: "Guide / how-to", desc: "Step-by-step article" },
  { icon: List, name: "Listicle", desc: "“5 things…” roundup" },
  { icon: Megaphone, name: "Announcement", desc: "Share news or an offer" },
  { icon: Utensils, name: "Recipe", desc: "From the farm kitchen" },
  { icon: Images, name: "Photo story", desc: "Image-led journal entry" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function BlogManager({
  websiteId,
  initialPosts,
  initialCategories,
  initialAuthors,
}: {
  websiteId: string;
  initialPosts: BlogPostRow[];
  initialCategories: BlogCategoryStat[];
  initialAuthors: BlogAuthorRow[];
}) {
  const t = useTranslations("website");
  const router = useRouter();

  const [posts, setPosts] = useState<BlogPostRow[]>(initialPosts);
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, startCreate] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const publishedCount = useMemo(
    () => posts.filter((p) => p.status === "published").length,
    [posts],
  );
  const shown = useMemo(
    () => (filter === "all" ? posts : posts.filter((p) => p.status === filter)),
    [posts, filter],
  );

  function onNewPost() {
    startCreate(async () => {
      const res = await createBlogPostAction(websiteId);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      router.push(`/dashboard/website/${websiteId}/blog/${res.id}`);
    });
  }

  async function onToggleFeatured(post: BlogPostRow) {
    setMenuId(null);
    const next = !post.featured;
    setPosts((ps) =>
      ps.map((p) => (p.id === post.id ? { ...p, featured: next } : p)),
    );
    const res = await setBlogFeaturedAction(websiteId, post.id, next);
    if (!res.ok) {
      setPosts((ps) =>
        ps.map((p) => (p.id === post.id ? { ...p, featured: !next } : p)),
      );
      toast.error(t("saveError"));
    }
  }

  async function onDelete(post: BlogPostRow) {
    setMenuId(null);
    const ok = await modal.destructive({
      title: t("blogDeleteTitle"),
      description: t("blogDeleteBody", {
        title: post.title || t("blogUntitled"),
      }),
      confirmLabel: t("blogDeleteConfirm"),
    });
    if (!ok) return;
    const res = await deleteBlogPostAction(websiteId, post.id);
    if (!res.ok) {
      toast.error(t("saveError"));
      return;
    }
    setPosts((ps) => ps.filter((p) => p.id !== post.id));
    toast.success(t("blogPostDeleted"));
    router.refresh();
  }

  return (
    <div className="vilo-cms">
      {/* header row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <h1
            className="font-display text-[20px] font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {t("tabBlog")}
          </h1>
          <span className="tag gray num">{posts.length}</span>
        </div>
        <span
          className="hidden text-[12.5px] lg:inline"
          style={{ color: "var(--mute)" }}
        >
          {t("blogPublishedCount", { count: publishedCount })}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="btn btn-ghost btn-sm"
          >
            <Tag style={{ width: 15, height: 15, color: "var(--mute)" }} />
            {t("blogManageCats")}
          </button>
          <div className="eseg">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? "on" : ""}
                onClick={() => setFilter(f)}
              >
                {t(`blogFilter_${f}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus style={{ width: 15, height: 15 }} />
            {t("blogNewPost")}
          </button>
        </div>
      </div>

      {/* table — no overflow clip so the row ⋯ menu can escape the card */}
      <section className="card">
        <div
          className="ptr"
          style={{
            gridTemplateColumns: GRID,
            cursor: "default",
            background: "#FAFCFB",
            borderBottom: "1px solid var(--line)",
            borderRadius: "16px 16px 0 0",
            paddingTop: 11,
            paddingBottom: 11,
          }}
        >
          <div className="smallcaps">{t("blogColPost")}</div>
          <div className="smallcaps">{t("blogColCategory")}</div>
          <div className="smallcaps">{t("blogColStatus")}</div>
          <div className="smallcaps">{t("blogColPublished")}</div>
          <div className="smallcaps text-right">{t("blogColActions")}</div>
        </div>
        <div className="p-2">
          {shown.length === 0 ? (
            <div
              className="px-4 py-12 text-center text-[13px]"
              style={{ color: "var(--mute)" }}
            >
              {posts.length === 0 ? t("blogEmpty") : t("blogNoMatches")}
            </div>
          ) : (
            shown.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                websiteId={websiteId}
                t={t}
                menuOpen={menuId === post.id}
                onMenu={() =>
                  setMenuId((id) => (id === post.id ? null : post.id))
                }
                onToggleFeatured={() => onToggleFeatured(post)}
                onDelete={() => onDelete(post)}
              />
            ))
          )}
        </div>
      </section>

      <div
        className="mt-4 flex items-center gap-2 text-[12px]"
        style={{ color: "var(--mute)" }}
      >
        <Info style={{ width: 14, height: 14, color: "#10B981" }} />
        {t("blogFooterNote")}
      </div>

      {menuId ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuId(null)}
          aria-hidden
        />
      ) : null}

      {newOpen ? (
        <NewPostModal
          t={t}
          creating={creating}
          onClose={() => setNewOpen(false)}
          onPick={onNewPost}
        />
      ) : null}

      {manageOpen ? (
        <ManageModal
          t={t}
          websiteId={websiteId}
          initialCategories={initialCategories}
          initialAuthors={initialAuthors}
          onClose={() => setManageOpen(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function statusTag(status: string, t: ReturnType<typeof useTranslations>) {
  const cls =
    status === "published" ? "green" : status === "scheduled" ? "sky" : "gray";
  const label =
    status === "published"
      ? t("publishedBadge")
      : status === "scheduled"
        ? t("blogStatusScheduledBadge")
        : t("draftBadge");
  return (
    <span className={`tag ${cls}`}>
      <span className="d" />
      {label}
    </span>
  );
}

function PostRow({
  post,
  websiteId,
  t,
  menuOpen,
  onMenu,
  onToggleFeatured,
  onDelete,
}: {
  post: BlogPostRow;
  websiteId: string;
  t: ReturnType<typeof useTranslations>;
  menuOpen: boolean;
  onMenu: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
}) {
  const cover = websiteAssetUrl(post.coverPath);
  const dateLabel =
    post.status === "scheduled"
      ? t("blogDateScheduled", { date: fmtDate(post.publishAt) })
      : post.status === "published"
        ? fmtDate(post.publishAt) || fmtDate(post.updatedAt)
        : t("blogDateEdited", { date: fmtDate(post.updatedAt) });
  const subParts = [
    post.authorName ? t("blogByAuthor", { name: post.authorName }) : null,
    `/blog/${post.slug}`,
  ].filter(Boolean);

  return (
    <Link
      href={`/dashboard/website/${websiteId}/blog/${post.id}`}
      className="ptr"
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="pthumb">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" />
          ) : (
            <>
              <div className="tb" />
              <div className="ph" />
            </>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {post.featured ? (
              <Star
                style={{ width: 13, height: 13, color: "#F59E0B" }}
                fill="#F59E0B"
              />
            ) : null}
            <span
              className="truncate font-display text-[14px] font-bold"
              style={{ color: "var(--ink)" }}
            >
              {post.title || t("blogUntitled")}
            </span>
          </div>
          <div
            className="truncate text-[11.5px]"
            style={{ color: "var(--mute)" }}
          >
            {subParts.join(" · ")}
          </div>
        </div>
      </div>

      <div className="text-[12.5px]">
        {post.categoryName ? (
          <span className="tag" style={CAT_CHIP}>
            {post.categoryName}
          </span>
        ) : (
          <span style={{ color: "var(--mute)" }}>—</span>
        )}
      </div>

      <div>{statusTag(post.status, t)}</div>

      <div className="text-[12.5px]" style={{ color: "var(--mute)" }}>
        {dateLabel}
      </div>

      <div className="relative flex items-center justify-end gap-1.5">
        <span className="btn btn-ghost btn-sm" style={{ height: 32 }}>
          <Pencil style={{ width: 14, height: 14, color: "var(--mute)" }} />
          {t("blogEdit")}
        </span>
        <button
          type="button"
          className="icon-btn"
          style={{ height: 32, width: 32 }}
          aria-label={t("blogPostMenu")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenu();
          }}
        >
          <MoreHorizontal style={{ width: 17, height: 17 }} />
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-[11px] border bg-white py-1 shadow-lift"
            style={{ borderColor: "var(--line)" }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={onToggleFeatured}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#FAFCFB]"
              style={{ color: "var(--ink)" }}
            >
              <Star style={{ width: 14, height: 14, color: "#F59E0B" }} />
              {post.featured ? t("blogUnfeature") : t("blogFeature")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
            >
              <Trash2 style={{ width: 14, height: 14 }} />
              {t("blogDeletePost")}
            </button>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function ModalShell({
  icon,
  title,
  sub,
  onClose,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div
          className="flex items-center gap-3 border-b px-6 py-5"
          style={{ borderColor: "var(--line)" }}
        >
          <span
            className="flex items-center justify-center"
            style={{
              height: 34,
              width: 34,
              borderRadius: 9,
              background: "var(--soft)",
              color: "#064E3B",
            }}
          >
            {icon}
          </span>
          <div className="flex-1">
            <div
              className="font-display text-[17px] font-extrabold"
              style={{ color: "var(--ink)" }}
            >
              {title}
            </div>
            <div className="text-[12.5px]" style={{ color: "var(--mute)" }}>
              {sub}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewPostModal({
  t,
  creating,
  onClose,
  onPick,
}: {
  t: ReturnType<typeof useTranslations>;
  creating: boolean;
  onClose: () => void;
  onPick: () => void;
}) {
  return (
    <ModalShell
      icon={<PenLine style={{ width: 18, height: 18 }} />}
      title={t("blogNewPost")}
      sub={t("blogNewModalSub")}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3">
        {TEMPLATES.map((tpl) => {
          const Icon = tpl.icon;
          return (
            <button
              key={tpl.name}
              type="button"
              className="tpl"
              disabled={creating}
              onClick={onPick}
            >
              <div className="tp-img">
                {creating ? (
                  <Loader2
                    className="animate-spin"
                    style={{ width: 26, height: 26 }}
                  />
                ) : (
                  <Icon style={{ width: 30, height: 30 }} />
                )}
              </div>
              <div className="tp-b">
                <div
                  className="font-display text-[13.5px] font-bold"
                  style={{ color: "var(--ink)" }}
                >
                  {tpl.name}
                </div>
                <div
                  className="mt-0.5 text-[11.5px]"
                  style={{ color: "var(--mute)" }}
                >
                  {tpl.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}

function ManageModal({
  t,
  websiteId,
  initialCategories,
  initialAuthors,
  onClose,
  onSaved,
}: {
  t: ReturnType<typeof useTranslations>;
  websiteId: string;
  initialCategories: BlogCategoryStat[];
  initialAuthors: BlogAuthorRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] =
    useState<BlogCategoryStat[]>(initialCategories);
  const [authors, setAuthors] = useState<BlogAuthorRow[]>(initialAuthors);
  const [savingCats, startSaveCats] = useTransition();
  const [savingAuthors, startSaveAuthors] = useTransition();

  function onSaveCategories() {
    startSaveCats(async () => {
      const res = await saveBlogCategoriesAction({
        websiteId,
        categories: categories.map((c) => ({
          id: c.id || undefined,
          name: c.name,
        })),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("blogCategoriesSaved"));
      onSaved();
    });
  }

  function onSaveAuthors() {
    if (authors.some((a) => !a.name.trim())) {
      toast.error(t("blogAuthorNameRequired"));
      return;
    }
    startSaveAuthors(async () => {
      const res = await saveBlogAuthorsAction({
        websiteId,
        authors: authors.map((a) => ({
          id: a.id || undefined,
          name: a.name,
          avatarPath: a.avatarPath,
          bio: a.bio,
        })),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("blogAuthorsSaved"));
      onSaved();
    });
  }

  return (
    <ModalShell
      icon={<Tag style={{ width: 18, height: 18 }} />}
      title={t("blogManageCats")}
      sub={t("blogManageSub")}
      onClose={onClose}
    >
      <div className="space-y-6 p-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Tag style={{ width: 15, height: 15, color: "#064E3B" }} />
            <h3
              className="font-display text-[14px] font-bold"
              style={{ color: "var(--ink)" }}
            >
              {t("blogCategoriesTitle")}
            </h3>
          </div>
          <ItemListEditor<BlogCategoryStat>
            label=""
            items={categories}
            onChange={setCategories}
            blank={() => ({ id: "", name: "", slug: "", count: 0 })}
            addLabel={t("blogAddCategory")}
            max={30}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("blogCategoryName")}
                  value={item.name}
                  onChange={(v) => patch({ name: v })}
                  maxLength={60}
                />
                {item.slug ? (
                  <p className="text-[11.5px] text-brand-mute">
                    /{item.slug} ·{" "}
                    {t("blogCategoryCount", { count: item.count })}
                  </p>
                ) : null}
              </>
            )}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onSaveCategories}
              disabled={savingCats}
              className="btn btn-primary btn-sm"
            >
              {savingCats ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("saveChanges")}
            </button>
          </div>
        </section>

        <section
          className="border-t pt-6"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <UserRound style={{ width: 15, height: 15, color: "#064E3B" }} />
            <h3
              className="font-display text-[14px] font-bold"
              style={{ color: "var(--ink)" }}
            >
              {t("blogAuthorsTitle")}
            </h3>
          </div>
          <ItemListEditor<BlogAuthorRow>
            label=""
            items={authors}
            onChange={setAuthors}
            blank={() => ({ id: "", name: "", avatarPath: "", bio: "" })}
            addLabel={t("blogAddAuthor")}
            max={50}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("blogAuthorName")}
                  value={item.name}
                  onChange={(v) => patch({ name: v })}
                  maxLength={120}
                />
                <ImageField
                  label={t("blogAuthorAvatar")}
                  websiteId={websiteId}
                  path={item.avatarPath || undefined}
                  onChange={(p) => patch({ avatarPath: p ?? "" })}
                />
                <TextArea
                  label={t("blogAuthorBio")}
                  value={item.bio}
                  onChange={(v) => patch({ bio: v })}
                  maxLength={600}
                  rows={2}
                />
              </>
            )}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onSaveAuthors}
              disabled={savingAuthors}
              className="btn btn-primary btn-sm"
            >
              {savingAuthors ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("saveChanges")}
            </button>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}
