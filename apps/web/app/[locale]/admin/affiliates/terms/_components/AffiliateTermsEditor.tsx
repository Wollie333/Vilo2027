"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AgreementBody } from "@/components/affiliate/AgreementBody";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import {
  agreementParagraphs,
  isAgreementHtml,
  renderAgreementBody,
} from "@/lib/affiliate/agreement.shared";

import { updateAffiliateTermsAction } from "../../actions";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Legacy terms were stored as blank-line plain text; seed the editor with real
// paragraphs so the admin doesn't start from one collapsed blob.
function toEditorHtml(content: string): string {
  if (isAgreementHtml(content)) return content;
  return agreementParagraphs(content)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
}

export function AffiliateTermsEditor({
  initialContent,
  initialVersion,
  brand,
}: {
  initialContent: string;
  initialVersion: string;
  brand: string;
}) {
  const [content, setContent] = useState(() => toEditorHtml(initialContent));
  const [version, setVersion] = useState(initialVersion);
  const [pending, start] = useTransition();

  const dirty =
    content !== toEditorHtml(initialContent) || version !== initialVersion;

  function save() {
    // stripHtml equivalent: reject an editor that's visually empty.
    if (!content.replace(/<[^>]*>/g, "").trim()) {
      toast.error("The terms can't be empty.");
      return;
    }
    start(async () => {
      const res = await updateAffiliateTermsAction({
        termsContent: content,
        termsVersion: version,
      });
      if (res.ok) {
        toast.success("Affiliate terms updated — live for everyone now.");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <section className="am-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="smallcaps">Edit terms</div>
          <label className="block">
            <span className="flabel">Version</span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1"
              className="fld h-9 w-28"
            />
          </label>
        </div>

        <div className="mt-4">
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Paste or write the affiliate terms — headings, lists and bold all work."
          />
        </div>

        <p className="mt-2 text-[12px] text-brand-mute">
          Paste straight from your lawyer&apos;s document — headings, lists and
          formatting are kept. Type{" "}
          <code className="rounded bg-brand-light px-1 py-0.5 text-[11px]">
            {"{brand}"}
          </code>{" "}
          wherever the brand name should appear — it renders as{" "}
          <span className="font-semibold text-brand-ink">{brand}</span>. Bump
          the version when you make a material change.
        </p>

        <div className="mt-4 flex items-center justify-end gap-3">
          {dirty ? (
            <span className="text-[12px] font-medium text-amber-600">
              Unsaved changes
            </span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="btn-pri h-9"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save terms"}
          </button>
        </div>
      </section>

      {/* Live preview — mirrors the gated programme */}
      <section className="am-card p-5">
        <div className="smallcaps">Preview</div>
        <p className="mt-0.5 text-[12px] text-brand-mute">
          How it appears to guests and hosts on the affiliate sign-up gate.
        </p>
        <div className="mt-4 rounded-[14px] border border-brand-line bg-brand-light/30 p-5">
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            Affiliate terms
          </h3>
          <div className="mt-3">
            {content.replace(/<[^>]*>/g, "").trim() ? (
              <AgreementBody rendered={renderAgreementBody(content, brand)} />
            ) : (
              <p className="text-sm italic text-brand-mute">
                Nothing to show yet.
              </p>
            )}
            <p className="mt-3 text-xs text-brand-mute/70">
              Terms version {version}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
