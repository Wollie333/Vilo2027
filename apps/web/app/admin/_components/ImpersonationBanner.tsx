import { Eye } from "lucide-react";

import { endImpersonationAction } from "../impersonation/actions";

export function ImpersonationBanner({
  targetUserId,
  startedAt,
}: {
  targetUserId: string;
  startedAt: string;
}) {
  const startedMs = new Date(startedAt).getTime();
  const elapsed = Math.floor((Date.now() - startedMs) / 1000 / 60);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-primary/30 bg-brand-primary/10 px-5 py-2.5 text-[12px] text-brand-secondary lg:px-8">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="font-semibold">View-only impersonation active</span>
        <span className="text-brand-mute">·</span>
        <span className="font-mono text-[11px]">{targetUserId}</span>
        <span className="text-brand-mute">·</span>
        <span>{elapsed}m elapsed</span>
      </div>
      <form action={endImpersonationAction}>
        <button
          type="submit"
          className="rounded-md border border-brand-secondary/30 bg-white px-3 py-1 text-[11px] font-semibold text-brand-secondary hover:bg-brand-accent"
        >
          End session
        </button>
      </form>
    </div>
  );
}
