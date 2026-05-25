import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { buildThumbnailUrl, formatDuration } from "@/lib/help/embed";
import type { HelpVideoRow } from "@/lib/help/types";

import { VideoCardClient } from "./VideoModal";

type Props = {
  videos: HelpVideoRow[];
  basePath: string;
  categoryLabel: Record<string, string>;
};

export function VideoTutorials({ videos, basePath, categoryLabel }: Props) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Watch & learn
          </div>
          <h3 className="mt-1 font-display text-xl font-bold text-brand-ink">
            Video tutorials
          </h3>
        </div>
        <Link
          href={`${basePath}/videos`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-secondary"
        >
          All videos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {videos.length === 0 ? (
        <p className="rounded-card border border-dashed border-brand-line bg-white px-5 py-10 text-center text-sm text-brand-mute">
          No videos published yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {videos.map((v) => (
            <VideoCardClient
              key={v.id}
              video={v}
              thumb={
                v.thumbnail_url ||
                buildThumbnailUrl(v.embed_provider, v.embed_id)
              }
              durationLabel={formatDuration(v.duration_seconds)}
              categoryLabel={
                v.category_id
                  ? (categoryLabel[v.category_id] ?? "Help")
                  : "Help"
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
