import { requirePermission } from "@/lib/admin";
import { loadAdminFeatureRequests } from "@/lib/buildBoard";

import { BuildBoardAdmin } from "./BuildBoardAdmin";

export const dynamic = "force-dynamic";

// WS-3a — Build Board moderation. Approve submissions onto the public board,
// move roadmap status, merge duplicates, remove junk.
export default async function AdminBuildBoardPage() {
  await requirePermission("platform.settings");
  const requests = await loadAdminFeatureRequests();

  const pending = requests.filter((r) => !r.isPublic && !r.mergedIntoId);
  const published = requests.filter((r) => r.isPublic && !r.mergedIntoId);
  const merged = requests.filter((r) => r.mergedIntoId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Build Board
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Public roadmap at{" "}
          <code className="rounded bg-brand-light px-1 py-0.5 text-[12px]">
            /build
          </code>
          . Approve submissions onto the board, move a card&rsquo;s status,
          merge duplicates, or remove junk.
        </p>
      </div>

      <BuildBoardAdmin
        pending={pending}
        published={published}
        merged={merged}
      />
    </div>
  );
}
