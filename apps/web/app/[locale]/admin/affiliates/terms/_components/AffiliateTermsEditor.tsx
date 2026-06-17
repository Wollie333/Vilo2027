"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { updateAffiliateTermsAction } from "../../actions";

// Splits the body on blank lines into paragraphs and swaps the {brand} token —
// matches how the gate renders it, so the preview is faithful.
function renderParagraphs(body: string, brand: string): string[] {
  return body
    .replace(/\{brand\}/g, brand)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
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
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);
  const [pending, start] = useTransition();

  const dirty = content !== initialContent || version !== initialVersion;
  const paragraphs = renderParagraphs(content, brand);

  function save() {
    if (!content.trim()) {
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
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-brand-ink">
            Edit terms
          </h2>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Version
            </span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1"
              className="h-9 w-28 rounded-md border border-brand-line bg-white px-3 text-sm focus:border-brand-primary focus:outline-none"
            />
          </label>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          className="mt-4 block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm leading-relaxed focus:border-brand-primary focus:outline-none"
        />
        <p className="mt-2 text-[12px] text-brand-mute">
          Use a blank line between paragraphs. Type{" "}
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
          <Button
            onClick={save}
            disabled={pending || !dirty}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save terms"}
          </Button>
        </div>
      </section>

      {/* Live preview — mirrors the gated programme */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-semibold text-brand-ink">
          Preview
        </h2>
        <p className="mt-0.5 text-[12px] text-brand-mute">
          How it appears to guests and hosts on the affiliate sign-up gate.
        </p>
        <div className="mt-4 rounded-card border border-brand-line bg-brand-light/30 p-5">
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            Affiliate terms
          </h3>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-brand-mute">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p className="italic">Nothing to show yet.</p>
            )}
            <p className="text-xs text-brand-mute/70">
              Terms version {version}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
