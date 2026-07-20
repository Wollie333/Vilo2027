import { requirePermission } from "@/lib/admin";
import {
  listAllChangelogEntries,
  listHostOptions,
  listShippedFeatureRequests,
} from "@/lib/changelog";

import { ChangelogManager } from "./ChangelogManager";

export const dynamic = "force-dynamic";

// WS-3b — curated, customer-facing changelog. Entries can credit the host who
// asked, by name, and deep-link a shipped Build Board item. Public at /change-log.
export default async function AdminChangelogPage() {
  await requirePermission("platform.settings");
  const [entries, hosts, shipped] = await Promise.all([
    listAllChangelogEntries(),
    listHostOptions(),
    listShippedFeatureRequests(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Changelog
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Curated, customer-facing updates published at{" "}
          <code className="rounded bg-brand-light px-1 py-0.5 text-[12px]">
            /change-log
          </code>
          . Credit the host who asked, by name. When no entries are published
          the page falls back to the repo <code>CHANGELOG.md</code>.
        </p>
      </div>

      <ChangelogManager
        entries={entries.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          bodyHtml: e.bodyHtml,
          creditedHostId: e.creditedHostId,
          creditedName: e.creditedName,
          featureRequestId: e.featureRequestId,
          shippedAt: e.shippedAt,
          isPublished: e.isPublished,
        }))}
        hosts={hosts}
        shipped={shipped}
      />
    </div>
  );
}
