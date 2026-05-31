"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

/**
 * Collapsible "About this place" body. Renders sanitised listing HTML and,
 * when it overflows the collapsed height, a fade + Show more / Show less
 * toggle — matching the design's `.fade-bottom` behaviour.
 */
export function AboutCollapsible({ html }: { html: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <div
        className={open ? "relative" : "relative max-h-[180px] overflow-hidden"}
      >
        <div
          className="space-y-4 text-[15px] leading-[1.65] text-brand-ink/85 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-brand-mute [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!open ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-white" />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-ink underline underline-offset-4 hover:text-brand-primary"
      >
        {open ? (
          <>
            Show less <ArrowUp className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            Show more <ArrowDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </div>
  );
}
