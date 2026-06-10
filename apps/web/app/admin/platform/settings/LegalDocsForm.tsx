"use client";

import { Gavel, Loader2, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/RichTextEditor";

import { saveLegalDocAction } from "./actions";

type Kind = "booking_terms" | "privacy";

export function LegalDocsForm({
  bookingTermsHtml,
  bookingTermsVersion,
  privacyHtml,
  privacyVersion,
}: {
  bookingTermsHtml: string | null;
  bookingTermsVersion: number;
  privacyHtml: string | null;
  privacyVersion: number;
}) {
  return (
    <div className="space-y-6">
      <LegalCard
        kind="booking_terms"
        icon={<Gavel className="h-4 w-4 text-brand-primary" />}
        title="Booking terms & conditions"
        hint="Platform-wide, Vilo-authored. Hosts cannot edit this — it applies to every booking on the platform and is shown at checkout and on /terms. Leave empty to use the built-in default copy."
        initialHtml={bookingTermsHtml ?? ""}
        version={bookingTermsVersion}
      />
      <LegalCard
        kind="privacy"
        icon={<ShieldCheck className="h-4 w-4 text-brand-primary" />}
        title="Privacy notice (POPIA)"
        hint="Platform-wide, Vilo-authored. Shown on /privacy and linked at checkout. Leave empty to use the built-in default copy."
        initialHtml={privacyHtml ?? ""}
        version={privacyVersion}
      />
    </div>
  );
}

function LegalCard({
  kind,
  icon,
  title,
  hint,
  initialHtml,
  version,
}: {
  kind: Kind;
  icon: React.ReactNode;
  title: string;
  hint: string;
  initialHtml: string;
  version: number;
}) {
  const router = useRouter();
  const [html, setHtml] = useState(initialHtml);
  const [pending, start] = useTransition();
  const dirty = html.trim() !== initialHtml.trim();

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      try {
        const res = await saveLegalDocAction({ kind, html: html.trim() });
        toast.success(`Saved — now version ${res.version}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display text-base font-bold text-brand-ink">
            {title}
          </h2>
        </div>
        <span className="rounded-pill bg-brand-light px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
          v{version}
        </span>
      </div>
      <p className="mt-1 text-sm text-brand-mute">{hint}</p>

      <div className="mt-4">
        <RichTextEditor
          value={html}
          onChange={setHtml}
          placeholder="Write the document text…"
          disabled={pending}
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Publishing…" : "Publish"}
        </button>
        <span className="ml-3 text-[11px] text-brand-mute">
          Publishing bumps the version and stamps it onto new bookings.
        </span>
      </div>
    </div>
  );
}
