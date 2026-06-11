import { ArrowRight, Plus, Video } from "lucide-react";
import Link from "next/link";

import { requirePermission } from "@/lib/admin";
import { buildThumbnailUrl, formatDuration } from "@/lib/help/embed";
import type {
  HelpStatus,
  HelpVideoProvider,
  HelpVideoRow,
} from "@/lib/help/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminHelpVideosPage() {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const { data } = await service
    .from("help_videos")
    .select("*")
    .is("deleted_at", null)
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as HelpVideoRow[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Help videos
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            YouTube &amp; Vimeo tutorials shown on the help home and category
            pages.
          </p>
        </div>
        <Link
          href="/admin/help/videos/new"
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New video
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="col-span-full rounded-card border border-dashed border-brand-line bg-white px-5 py-10 text-center text-sm text-brand-mute">
            No videos yet.{" "}
            <Link
              href="/admin/help/videos/new"
              className="text-brand-primary hover:underline"
            >
              Add one
            </Link>
            .
          </div>
        ) : null}
        {rows.map((v) => (
          <Link
            key={v.id}
            href={`/admin/help/videos/${v.id}`}
            className="group overflow-hidden rounded-card border border-brand-line bg-white transition-shadow hover:shadow-lift"
          >
            <div className="relative aspect-video overflow-hidden bg-brand-secondary">
              {v.thumbnail_url ||
              buildThumbnailUrl(
                v.embed_provider as HelpVideoProvider,
                v.embed_id,
              ) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    v.thumbnail_url ||
                    buildThumbnailUrl(
                      v.embed_provider as HelpVideoProvider,
                      v.embed_id,
                    )
                  }
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-secondary" />
              )}
              <div className="absolute bottom-2 right-2 rounded bg-brand-dark/90 px-1.5 py-0.5 font-mono text-[10px] text-white">
                {formatDuration(v.duration_seconds)}
              </div>
              <StatusBadge status={v.status as HelpStatus} />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-[11px] text-brand-mute">
                <Video className="h-3.5 w-3.5" />
                {v.embed_provider.toUpperCase()} · {v.embed_id}
              </div>
              <h3 className="mt-1 font-display text-sm font-semibold leading-snug text-brand-ink">
                {v.title}
              </h3>
              <div className="mt-3 flex items-center justify-end text-[11px] font-medium text-brand-primary">
                Edit <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: HelpStatus }) {
  const cls: Record<HelpStatus, string> = {
    published: "bg-emerald-500/90",
    draft: "bg-amber-500/90",
    archived: "bg-brand-mute/90",
  };
  return (
    <span
      className={`absolute left-2 top-2 inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ${cls[status]}`}
    >
      {status}
    </span>
  );
}
