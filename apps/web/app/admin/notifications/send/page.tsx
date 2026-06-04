import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/admin/requirePermission";

import { SendForm } from "./SendForm";

export const metadata: Metadata = {
  title: "Send notification · Admin",
};

export const dynamic = "force-dynamic";

export default async function SendNotificationPage() {
  await requirePermission("notifications.send_individual");
  return (
    <section>
      <header className="mb-6">
        <Link
          href="/admin/notifications/sent"
          className="text-xs text-brand-mute hover:text-brand-ink"
        >
          ← Back to sent
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink">
          Send notification
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Compose a direct notification for one or more specific users. Saved to
          your send history and logged to the audit trail.
        </p>
      </header>
      <SendForm />
    </section>
  );
}
