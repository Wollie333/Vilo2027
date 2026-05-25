import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Database, FileCode } from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { EMAIL_REGISTRY } from "@/lib/email/registry";
import { hasResolver } from "@/lib/email/resolvers";

import { getRefSpec } from "../expectedRefs";
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
  const refSpec = getRefSpec(params.type);
  const resolverWired = hasResolver(params.type);

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

      {refSpec ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            {resolverWired ? (
              <Database className="h-4 w-4 text-brand-primary" />
            ) : (
              <FileCode className="h-4 w-4 text-brand-mute" />
            )}
            <h2 className="font-display text-sm font-semibold text-brand-ink">
              Expected payload from <code>notification_queue.payload</code>
            </h2>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Required keys
              </div>
              <ul className="mt-1.5 space-y-1 text-[12.5px]">
                {refSpec.required.map((k) => (
                  <li key={k}>
                    <code className="rounded bg-brand-light px-1.5 py-0.5 text-brand-ink">
                      {k}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
            {refSpec.optional && refSpec.optional.length > 0 ? (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Optional overrides
                </div>
                <ul className="mt-1.5 space-y-1 text-[12.5px]">
                  {refSpec.optional.map((k) => (
                    <li key={k}>
                      <code className="rounded bg-brand-light px-1.5 py-0.5 text-brand-mute">
                        {k}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {refSpec.note ? (
            <p className="mt-3 rounded border border-brand-line bg-brand-light/40 p-3 text-[12px] text-brand-mute">
              {refSpec.note}
            </p>
          ) : null}

          <p className="mt-3 text-[12px] text-brand-mute">
            {resolverWired ? (
              <>
                <strong className="text-brand-ink">Resolver active.</strong> The
                worker pulls listing / host / guest / booking data from the DB
                at send time. Any field you put in payload overrides the
                resolved value (handy for one-off overrides and for the preview
                tool below).
              </>
            ) : (
              <>
                <strong className="text-brand-ink">No DB resolver.</strong> The
                enqueueing code must put every template prop into payload
                directly.
              </>
            )}
          </p>
        </section>
      ) : null}

      <PreviewTester
        type={params.type}
        initialPayload={sample}
        defaultTestTo={admin.email}
      />
    </div>
  );
}
