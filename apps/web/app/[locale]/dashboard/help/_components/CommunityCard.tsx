import { MessageSquarePlus, Users } from "lucide-react";
import Link from "next/link";

import type { HelpCommunityThread } from "@/lib/help/types";

type Props = {
  threads: HelpCommunityThread[];
  forumHref?: string;
};

const ACCENT_BG: Record<HelpCommunityThread["accent"], string> = {
  primary: "bg-brand-primary text-white",
  secondary: "bg-brand-secondary text-white",
  mute: "bg-brand-mute text-white",
};

export function CommunityCard({ threads, forumHref = "/community" }: Props) {
  return (
    <div
      id="community"
      className="flex scroll-mt-20 flex-col rounded-card border border-brand-line bg-white p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Hosts helping hosts
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            Community forum
          </h3>
        </div>
        <Users className="h-5 w-5 text-brand-mute" />
      </div>

      <ul className="mt-4 flex-1 space-y-3">
        {threads.length === 0 ? (
          <li className="rounded border border-dashed border-brand-line px-3 py-4 text-center text-xs text-brand-mute">
            Community threads will appear here once moderators feature them.
          </li>
        ) : null}
        {threads.map((t, i) => (
          <li key={`${t.title}-${i}`} className="flex items-start gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ACCENT_BG[t.accent]}`}
            >
              {t.initials}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={forumHref}
                className="text-sm font-medium text-brand-ink hover:underline"
              >
                {t.title}
              </Link>
              <div className="mt-0.5 text-[11px] text-brand-mute">
                {t.author} · {t.replies} {t.replies === 1 ? "reply" : "replies"}{" "}
                · {t.ago}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href={forumHref}
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
      >
        <MessageSquarePlus className="h-4 w-4" /> Open the forum
      </Link>
    </div>
  );
}
