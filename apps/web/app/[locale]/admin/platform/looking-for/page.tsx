import type { Metadata } from "next";
import { ListChecks } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { getLookingForRequirementsForAdmin } from "@/lib/looking-for/requirements";

import { RequirementsAdmin } from "./RequirementsAdmin";

export const metadata: Metadata = { title: "Looking-For requirements" };
export const dynamic = "force-dynamic";

export default async function LookingForRequirementsPage() {
  await requirePermission("taxonomy.manage");
  const { groups, options } = await getLookingForRequirementsForAdmin();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <ListChecks className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Looking-For requirements
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Manage the accommodation-requirement options guests pick from when
            posting a request. Guests select these; they can&apos;t add their
            own.
          </p>
        </div>
      </header>

      <RequirementsAdmin groups={groups} options={options} />
    </div>
  );
}
