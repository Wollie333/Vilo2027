import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { EMAIL_REGISTRY } from "@/lib/email/registry";

import { getSamplePayload } from "../samplePayloads";
import { PreviewTester } from "./PreviewTester";

export const dynamic = "force-dynamic";

export default async function AdminEmailDetailPage({
  params,
}: {
  params: { type: string };
}) {
  const admin = await requireAdmin();

  const entry = EMAIL_REGISTRY[params.type];
  if (!entry) notFound();

  const sample = getSamplePayload(params.type);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/emails"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-mute hover:text-brand-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All templates
      </Link>

      <header>
        <h1 className="font-mono text-xl font-bold text-brand-ink">
          {params.type}
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Subject preview: <strong>{entry.subject(sample)}</strong> · Recipient:{" "}
          <strong className="capitalize">{entry.recipient}</strong>
          {entry.recipient === "custom" ? (
            <>
              {" "}
              (reads <code>payload.recipient_email</code>)
            </>
          ) : null}
        </p>
      </header>

      <PreviewTester
        type={params.type}
        initialPayload={sample}
        defaultTestTo={admin.email}
      />
    </div>
  );
}
