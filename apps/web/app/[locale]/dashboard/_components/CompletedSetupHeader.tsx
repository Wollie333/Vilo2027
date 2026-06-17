"use client";

import { Bell, ClipboardList, ExternalLink, Sparkles, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";

const LS_CHECKLIST = "vilo:dash:show-checklist";
const LS_ATTENTION = "vilo:dash:show-attention";

// Shown only once setup is 100% complete. The setup checklist + "what needs
// your attention" cards are hidden by default for a clean dashboard; two small
// hero icons toggle them back, and each card carries an X to dismiss again.
// Preference persists per-browser. Below 100% these cards render unconditionally
// elsewhere (no toggle) — see dashboard/page.tsx.
export function CompletedSetupHeader({
  firstName,
  handle,
  pendingCount,
  checklist,
  attention,
}: {
  firstName: string;
  handle: string;
  pendingCount: number | null;
  checklist: React.ReactNode;
  attention: React.ReactNode;
}) {
  const [showChecklist, setShowChecklist] = useState(false);
  const [showAttention, setShowAttention] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setShowChecklist(localStorage.getItem(LS_CHECKLIST) === "1");
    setShowAttention(localStorage.getItem(LS_ATTENTION) === "1");
    setHydrated(true);
  }, []);

  function toggleChecklist(v: boolean) {
    setShowChecklist(v);
    localStorage.setItem(LS_CHECKLIST, v ? "1" : "0");
  }
  function toggleAttention(v: boolean) {
    setShowAttention(v);
    localStorage.setItem(LS_ATTENTION, v ? "1" : "0");
  }

  const iconBtn = (active: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded border transition-colors ${
      active
        ? "border-brand-primary bg-brand-accent text-brand-primary"
        : "border-brand-line bg-white text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
    }`;

  return (
    <>
      <section className="-mt-1 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Welcome back, {firstName}.
          </h2>
          <p className="mt-1 text-sm text-brand-mute">
            {pendingCount && pendingCount > 0
              ? `You have ${pendingCount} pending booking${
                  pendingCount === 1 ? "" : "s"
                } to review.`
              : "Nothing pending. Your inbox is empty."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          {/* Toggles to bring the (now-complete) setup cards back on demand. */}
          <button
            type="button"
            onClick={() => toggleChecklist(!showChecklist)}
            aria-pressed={showChecklist}
            title={
              showChecklist ? "Hide setup checklist" : "Show setup checklist"
            }
            className={iconBtn(showChecklist)}
          >
            <ClipboardList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => toggleAttention(!showAttention)}
            aria-pressed={showAttention}
            title={
              showAttention ? "Hide attention items" : "Show attention items"
            }
            className={iconBtn(showAttention)}
          >
            <Bell className="h-4 w-4" />
          </button>

          <Link
            href={`/${handle}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
          >
            View public page
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/dashboard/properties/new"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            <Sparkles className="h-4 w-4" />
            New listing
          </Link>
        </div>
      </section>

      {hydrated && (showChecklist || showAttention) ? (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {showChecklist ? (
            <Dismissable onClose={() => toggleChecklist(false)}>
              {checklist}
            </Dismissable>
          ) : null}
          {showAttention ? (
            <Dismissable onClose={() => toggleAttention(false)}>
              {attention}
            </Dismissable>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function Dismissable({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClose}
        aria-label="Hide card"
        title="Hide"
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-brand-mute shadow-card transition-colors hover:bg-white hover:text-brand-ink"
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}
