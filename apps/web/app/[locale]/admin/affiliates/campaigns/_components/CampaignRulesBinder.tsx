"use client";

import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  PencilLine,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setCampaignRulesDocAction } from "../actions";
import { CAMPAIGN_HELP } from "./campaignHelp";
import { FieldHelp } from "./FieldHelp";

// The competition's Rules surface. Rules TEXT is the single source of truth in
// Admin → Legal docs; this screen only BINDS the campaign to one of those
// documents (writes affiliate_campaigns.rules_doc_slug) and reflects it. No
// legal text is ever edited here — there is exactly one place it can change.

export type RulesDocOption = {
  slug: string;
  title: string;
  version: number;
  isPublished: boolean;
  bodyHtml: string | null;
};

export function CampaignRulesBinder({
  campaignId,
  docs,
  boundSlug,
  acceptedCount,
  staleCount,
}: {
  campaignId: string;
  /** Every Legal-docs document — the bindable set (SSOT). */
  docs: RulesDocOption[];
  /** The document currently bound as this campaign's rules, or null. */
  boundSlug: string | null;
  /** How many partners have accepted the rules on entry. */
  acceptedCount: number;
  /** …of which, how many accepted a version older than the current one. */
  staleCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string>(boundSlug ?? "");

  const bound = docs.find((d) => d.slug === selected) ?? null;

  function bind(nextSlug: string) {
    const prev = selected;
    setSelected(nextSlug);
    start(async () => {
      const res = await setCampaignRulesDocAction({
        campaignId,
        docSlug: nextSlug || null,
      });
      if (res.ok) {
        toast.success(
          nextSlug ? "Rules document bound." : "Rules document unbound.",
        );
        router.refresh();
      } else {
        setSelected(prev); // revert the picker on failure
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="am-card p-5">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-brand-ink">
        <FileText className="h-4 w-4 text-brand-primary" />
        Competition rules
        <FieldHelp help={CAMPAIGN_HELP.rulesDoc} />
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-mute" />
        ) : null}
      </h2>
      <p className="mt-0.5 text-[12.5px] text-brand-mute">
        Choose which published document from{" "}
        <a
          href="/admin/legal"
          className="font-medium text-brand-primary hover:underline"
        >
          Legal docs
        </a>{" "}
        is this competition&apos;s rules. Every partner must accept it to enter,
        and each entry is stamped with the version they saw.
      </p>

      {/* Binder */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[16rem] flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Bound rules document
          </span>
          <select
            value={selected}
            onChange={(e) => bind(e.target.value)}
            disabled={pending}
            className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary disabled:opacity-60"
          >
            <option value="">No rules bound — partners can enter freely</option>
            {docs.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.title} · v{d.version}
                {d.isPublished ? "" : " (draft — not live)"}
              </option>
            ))}
          </select>
        </label>
        <a
          href="/admin/legal"
          target="_blank"
          rel="noreferrer"
          className="btn-sec inline-flex h-[42px] items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New in Legal docs
        </a>
      </div>

      {docs.length === 0 ? (
        <div className="mt-4 rounded-card border border-dashed border-brand-line bg-brand-light/40 p-5 text-sm text-brand-mute">
          There are no legal documents yet. Create the competition rules in{" "}
          <a
            href="/admin/legal"
            className="font-semibold text-brand-primary underline"
          >
            Legal docs
          </a>{" "}
          — start from the CPA competition template — then come back and bind it
          here.
        </div>
      ) : null}

      {/* Bound-doc status + warnings */}
      {bound ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold text-brand-ink">
              {bound.title}
            </span>
            <span className="rounded-pill bg-brand-light px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
              v{bound.version}
            </span>
            <span
              className={`rounded-pill px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${
                bound.isPublished
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {bound.isPublished ? "Published" : "Draft"}
            </span>
            {acceptedCount > 0 ? (
              <span className="text-[12px] text-brand-mute">
                {acceptedCount} accepted
              </span>
            ) : null}
            <a
              href={`/legal/${bound.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-secondary hover:text-brand-primary"
            >
              /legal/{bound.slug}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {!bound.isPublished ? (
            <Warn>
              This document is a <strong>draft</strong> — it is not live at its
              public URL, so entrants can&apos;t read it. South African consumer
              law requires the rules to be published at a fixed URL for the
              whole competition. Publish it in Legal docs before you launch.
            </Warn>
          ) : null}

          {staleCount > 0 ? (
            <Warn>
              {staleCount} partner{staleCount === 1 ? "" : "s"} accepted an{" "}
              <strong>older version</strong> of these rules. Their signed record
              still shows the exact text they agreed to — but if the change was
              material, consider whether they need to re-accept.
            </Warn>
          ) : null}

          <div
            className="legal-prose mt-4 max-h-[420px] overflow-y-auto rounded-card border border-brand-line bg-white p-4 text-[13.5px] leading-relaxed text-brand-mute [&_a]:text-brand-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-brand-ink [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-brand-ink [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-brand-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{
              __html:
                bound.bodyHtml && bound.bodyHtml.trim().length > 0
                  ? bound.bodyHtml
                  : "<p><em>This document has no text yet — add it in Legal docs.</em></p>",
            }}
          />

          <div className="mt-4">
            <a
              href={`/admin/legal#doc-${bound.slug}`}
              className="btn-pri inline-flex h-9 items-center gap-1.5"
            >
              <PencilLine className="h-4 w-4" />
              Edit text in Legal docs
            </a>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
