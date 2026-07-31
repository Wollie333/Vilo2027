"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// An inline legal link that opens the document in a MODAL instead of navigating
// away — for checkout and signup, where losing the flow is costly. It fetches the
// PUBLISHED document from /api/legal/<key>; if nothing is published yet it falls
// back to opening the full page in a new tab (which shows the static copy), so the
// link is always useful. `docKey` is a placement key (terms | privacy | cookies)
// or a /legal/<slug> document slug.

const PROSE =
  "text-[14px] leading-relaxed text-brand-mute [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-brand-ink [&_h3]:mt-4 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-brand-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_p]:my-2.5 [&_strong]:font-semibold [&_strong]:text-brand-ink [&_a]:text-brand-primary [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      title: string;
      html: string;
      lastUpdated: string | null;
    }
  | { status: "error" };

export function LegalDocModalLink({
  docKey,
  label,
  className,
}: {
  docKey: string;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  const href = ["terms", "privacy", "cookies"].includes(docKey)
    ? `/${docKey}`
    : `/legal/${docKey}`;

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    // The link often sits inside a clickable <label>; don't toggle its checkbox.
    e.stopPropagation();
    if (state.status === "loaded") {
      setOpen(true);
      return;
    }
    setState({ status: "loading" });
    setOpen(true);
    try {
      const res = await fetch(`/api/legal/${encodeURIComponent(docKey)}`);
      if (!res.ok) {
        // Not published yet — open the full page (with its static copy) instead
        // so the link still does something useful, and don't trap the modal.
        setOpen(false);
        setState({ status: "idle" });
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      const data = (await res.json()) as {
        title: string;
        html: string;
        lastUpdated: string | null;
      };
      setState({
        status: "loaded",
        title: data.title,
        html: data.html,
        lastUpdated: data.lastUpdated,
      });
    } catch {
      setOpen(false);
      setState({ status: "idle" });
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <a
        href={href}
        onClick={handleClick}
        className={className ?? "font-semibold underline underline-offset-2"}
      >
        {label}
      </a>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {state.status === "loaded" ? state.title : label}
            </DialogTitle>
          </DialogHeader>
          {state.status === "loading" ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-brand-mute">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : state.status === "loaded" ? (
            <>
              {state.lastUpdated ? (
                <p className="-mt-1 text-[12px] text-brand-mute">
                  Last updated {state.lastUpdated}
                </p>
              ) : null}
              <div
                className={`mt-2 ${PROSE}`}
                dangerouslySetInnerHTML={{ __html: state.html }}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
