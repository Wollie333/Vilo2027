"use client";

import { ExternalLink, FileText, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/RichTextEditor";

import { saveCampaignRulesAction } from "../actions";
import { CAMPAIGN_HELP, FieldHelp } from "./FieldHelp";

// WS-1i follow-up — author the competition rules right here and publish them
// live at /legal/<slug>. That URL is the fixed retained address the CPA requires,
// and it is what every entrant signs: the version below is stamped onto each
// partner's entry record, so a partner can always be shown the exact text they
// entered under.

export function CampaignRulesEditor({
  campaignId,
  campaignSlug,
  campaignName,
  initial,
}: {
  campaignId: string;
  campaignSlug: string;
  campaignName: string;
  initial: {
    slug: string | null;
    title: string | null;
    html: string | null;
    version: number | null;
    isPublished: boolean;
    acceptedCount: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useState(
    initial.slug ?? `${campaignSlug || "campaign"}-rules`,
  );
  const [title, setTitle] = useState(
    initial.title ?? `${campaignName} — Competition Rules`,
  );
  const [html, setHtml] = useState(initial.html ?? "");
  const [version, setVersion] = useState(initial.version ?? null);

  function save() {
    startTransition(async () => {
      const res = await saveCampaignRulesAction({
        campaignId,
        slug,
        title,
        html,
      });
      if (res.ok && res.data) {
        setVersion(res.data.version);
        toast.success(
          `Rules published — live at /legal/${res.data.slug} (version ${res.data.version}).`,
        );
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="am-card p-5">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-brand-ink">
        <FileText className="h-4 w-4 text-brand-primary" />
        Competition rules
        <FieldHelp help={CAMPAIGN_HELP.rulesEditor} />
      </h2>
      <p className="mt-0.5 text-[12.5px] text-brand-mute">
        Published live at a fixed URL. Every partner must accept these rules to
        enter, and their acceptance is recorded against the version below.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="flabel">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="fld"
          />
        </label>
        <label className="block">
          <span className="flabel">Live URL</span>
          <div className="flex items-center gap-1.5">
            <span className="mono text-[12px] text-brand-mute">/legal/</span>
            <input
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+/, ""),
                )
              }
              className="fld mono text-[13px]"
            />
          </div>
        </label>
      </div>

      <div className="mt-4">
        <span className="flabel">The rules</span>
        <div className="mt-1">
          <RichTextEditor
            value={html}
            onChange={setHtml}
            placeholder="Who may enter, how scoring works, the prizes, the closing date, how disputes are handled…"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn-pri h-9"
        >
          <Save className="h-4 w-4" />
          {pending
            ? "Publishing…"
            : version
              ? "Publish new version"
              : "Publish rules"}
        </button>

        {version ? (
          <>
            <span className="text-[12.5px] text-brand-mute">
              Live at version {version}
              {initial.acceptedCount > 0
                ? ` · ${initial.acceptedCount} partner${initial.acceptedCount === 1 ? "" : "s"} accepted`
                : ""}
            </span>
            <a
              href={`/legal/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-primary hover:underline"
            >
              View live page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </>
        ) : null}
      </div>

      {version && initial.acceptedCount > 0 ? (
        <p className="mt-3 text-[12px] text-brand-mute">
          Editing the text publishes a new version. Partners who already entered
          keep the signature for the version they accepted — their record still
          shows the exact text they agreed to.
        </p>
      ) : null}
    </section>
  );
}
