import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";

import { BroadcastForm } from "../../BroadcastForm";
import type { BroadcastInput } from "../../schemas";

export const metadata: Metadata = {
  title: "Edit broadcast · Admin",
};

export const dynamic = "force-dynamic";

// Postgres timestamptz ("2026-08-05 13:19:53.232+00") → datetime-local value
// ("2026-08-05T13:19"). Matches the wall-clock string shape the create form
// already produces and stores.
function toDatetimeLocal(value: string | null): string | null {
  if (!value) return null;
  return value.replace(" ", "T").slice(0, 16);
}

export default async function EditBroadcastPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("notifications.broadcast");
  const service = createAdminClient();
  const { data: b } = await service
    .from("broadcast_announcements")
    .select(
      "id, severity, audience, title, body, link_url, link_label, requires_ack, show_banner, banner_surfaces, banner_dismiss_mode, starts_at, ends_at, cancelled_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!b) notFound();

  if (b.cancelled_at) {
    return (
      <section className="space-y-4">
        <Link
          href={`/admin/broadcasts/${b.id}`}
          className="text-xs text-brand-mute hover:text-brand-ink"
        >
          ← Back to broadcast
        </Link>
        <p className="rounded-card border border-brand-line bg-white p-5 text-sm text-brand-mute shadow-card">
          This broadcast has been cancelled and can no longer be edited.
        </p>
      </section>
    );
  }

  const surfaces = ((b.banner_surfaces as string[] | null) ?? []).filter(
    (s): s is "dashboard" | "public" => s === "dashboard" || s === "public",
  );

  const initial: Partial<BroadcastInput> = {
    severity: b.severity as BroadcastInput["severity"],
    audience: b.audience as BroadcastInput["audience"],
    title: b.title as string,
    body: b.body as string,
    link_url: (b.link_url as string | null) ?? "",
    link_label: (b.link_label as string | null) ?? "",
    starts_at: toDatetimeLocal(b.starts_at as string | null),
    ends_at: toDatetimeLocal(b.ends_at as string | null),
    requires_ack: b.requires_ack as boolean,
    show_banner: b.show_banner as boolean,
    banner_surfaces: surfaces,
    banner_dismiss_mode:
      b.banner_dismiss_mode as BroadcastInput["banner_dismiss_mode"],
  };

  return (
    <section className="space-y-6">
      <header>
        <Link
          href={`/admin/broadcasts/${b.id}`}
          className="text-xs text-brand-mute hover:text-brand-ink"
        >
          ← Back to broadcast
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink">
          Edit broadcast
        </h1>
        <p className="text-sm text-brand-mute">
          Audience and severity are locked — the notification already went out.
          Edits to content and banner display apply immediately.
        </p>
      </header>

      <BroadcastForm
        mode="edit"
        initial={initial}
        editContext={{
          id: b.id as string,
          severity: b.severity as string,
          audience: b.audience as string,
        }}
      />
    </section>
  );
}
