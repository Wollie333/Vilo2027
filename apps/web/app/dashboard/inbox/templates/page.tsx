import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Quick reply templates · Inbox · Vilo",
};

export default function TemplatesComingSoonPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/inbox"
        className="inline-flex items-center gap-1 text-[12px] text-brand-mute hover:text-brand-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to inbox
      </Link>

      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Quick reply templates &mdash; coming soon
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-mute">
          Save common replies once &mdash; confirm dates, share check-in
          details, send banking info, politely decline &mdash; and reuse them
          with one tap from the inbox composer. Landing in a future release.
        </p>
        <Link
          href="/dashboard/inbox"
          className="mt-5 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
        >
          Go back to inbox
        </Link>
      </div>
    </div>
  );
}
