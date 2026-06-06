import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { TemplatesManager, type Template } from "./TemplatesManager";

export const metadata: Metadata = {
  title: "Message templates · Inbox",
};

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/inbox/templates");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: templates } = host
    ? await supabase
        .from("message_templates")
        .select("id, title, body, sort_order")
        .eq("host_id", host.id)
        .order("sort_order")
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link
        href="/dashboard/inbox"
        className="inline-flex items-center gap-1 text-[12px] text-brand-mute hover:text-brand-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to inbox
      </Link>

      <div>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Message templates
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Save replies once and reuse them from the inbox composer, the guest
          record, and broadcasts. Use{" "}
          <code className="rounded bg-brand-light px-1 text-[12px] text-brand-secondary">
            {"{{guest_name}}"}
          </code>
          ,{" "}
          <code className="rounded bg-brand-light px-1 text-[12px] text-brand-secondary">
            {"{{listing_name}}"}
          </code>
          ,{" "}
          <code className="rounded bg-brand-light px-1 text-[12px] text-brand-secondary">
            {"{{check_in}}"}
          </code>{" "}
          and{" "}
          <code className="rounded bg-brand-light px-1 text-[12px] text-brand-secondary">
            {"{{check_out}}"}
          </code>{" "}
          as merge tokens.
        </p>
      </div>

      <TemplatesManager templates={(templates ?? []) as Template[]} />
    </div>
  );
}
