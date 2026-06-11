import { requirePermission } from "@/lib/admin";
import type { HelpStatusRow } from "@/lib/help/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { StatusEditor } from "./StatusEditor";

export const dynamic = "force-dynamic";

export default async function AdminHelpStatusPage() {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const { data } = await service
    .from("help_status_components")
    .select("*")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          System status
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          The panel on /help/#status. Edit manually during incidents — the
          overall pill is derived from the worst component status.
        </p>
      </header>

      <StatusEditor rows={(data ?? []) as HelpStatusRow[]} />
    </div>
  );
}
