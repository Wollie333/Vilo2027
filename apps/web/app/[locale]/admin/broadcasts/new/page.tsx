import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

import { requirePermission } from "@/lib/admin/requirePermission";

import { BroadcastForm } from "../BroadcastForm";

export const metadata: Metadata = {
  title: "New broadcast · Admin",
};

export const dynamic = "force-dynamic";

export default async function NewBroadcastPage() {
  await requirePermission("notifications.broadcast");
  return (
    <section>
      <header className="mb-6">
        <Link
          href="/admin/broadcasts"
          className="text-xs text-brand-mute hover:text-brand-ink"
        >
          ← Back to broadcasts
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink">
          New broadcast
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Compose a site-wide announcement. Every create / cancel is logged to
          the audit trail under target_type = &quot;broadcast&quot;.
        </p>
      </header>
      <BroadcastForm />
    </section>
  );
}
