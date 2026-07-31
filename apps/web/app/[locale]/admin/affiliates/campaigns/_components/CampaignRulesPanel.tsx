import { ExternalLink, FileText, PencilLine } from "lucide-react";

import { CAMPAIGN_HELP, FieldHelp } from "./FieldHelp";

// Read-only reflection of the campaign's competition-rules document. The rules
// live in the single source of truth (Admin → Legal docs) as a legal_documents
// row; a campaign binds to one via the "Rules document" field in Settings. This
// panel shows the live text and links out to edit it — it never edits here, so
// there is exactly one place the rules can change.
export function CampaignRulesPanel({
  initial,
}: {
  initial: {
    slug: string | null;
    title: string | null;
    html: string | null;
    version: number | null;
    isPublished: boolean;
    acceptedCount: number;
  };
}) {
  const bound = Boolean(initial.slug);

  return (
    <section className="am-card p-5">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-brand-ink">
        <FileText className="h-4 w-4 text-brand-primary" />
        Competition rules
        <FieldHelp help={CAMPAIGN_HELP.rulesEditor} />
      </h2>
      <p className="mt-0.5 text-[12.5px] text-brand-mute">
        Managed in the single source of truth. Every partner must accept these
        rules to enter, and their acceptance is recorded against the version.
      </p>

      {!bound ? (
        <div className="mt-4 rounded-card border border-dashed border-brand-line bg-brand-light/40 p-5 text-sm text-brand-mute">
          No rules document is bound to this campaign yet. Create the rules in{" "}
          <a
            href="/admin/legal"
            className="font-semibold text-brand-primary underline"
          >
            Legal docs
          </a>
          , then select it under <strong>Settings → Rules document</strong>.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold text-brand-ink">
              {initial.title ?? initial.slug}
            </span>
            <span className="rounded-pill bg-brand-light px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
              v{initial.version ?? 1}
            </span>
            <span
              className={`rounded-pill px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${
                initial.isPublished
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {initial.isPublished ? "Published" : "Draft"}
            </span>
            {initial.acceptedCount > 0 ? (
              <span className="text-[12px] text-brand-mute">
                {initial.acceptedCount} accepted
              </span>
            ) : null}
            <a
              href={`/legal/${initial.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-secondary hover:text-brand-primary"
            >
              /legal/{initial.slug}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div
            className="legal-prose mt-4 max-h-[420px] overflow-y-auto rounded-card border border-brand-line bg-white p-4 text-[13.5px] leading-relaxed text-brand-mute [&_a]:text-brand-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-brand-ink [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-brand-ink [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-brand-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{
              __html:
                initial.html && initial.html.trim().length > 0
                  ? initial.html
                  : "<p><em>This document has no text yet — add it in Legal docs.</em></p>",
            }}
          />

          <div className="mt-4">
            <a
              href={`/admin/legal#doc-${initial.slug}`}
              className="btn-pri inline-flex h-9 items-center gap-1.5"
            >
              <PencilLine className="h-4 w-4" />
              Edit in Legal docs
            </a>
          </div>

          {initial.acceptedCount > 0 ? (
            <p className="mt-3 text-[12px] text-brand-mute">
              Editing the text in Legal docs publishes a new version. Partners
              who already entered keep the signature for the version they
              accepted — their record still shows the exact text they agreed to.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
