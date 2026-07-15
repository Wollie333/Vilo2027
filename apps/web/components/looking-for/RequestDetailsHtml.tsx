import { sanitiseListingHtml } from "@/lib/sanitiseHtml";

// Renders a Looking-For request's rich-text "details" (Tiptap HTML). Content is
// already sanitised on write, but we sanitise again on read (defence in depth
// against any row written straight to the DB). Server component — safe to call
// the server-only sanitiser directly.
const PROSE =
  "text-sm leading-relaxed text-brand-mute [&_a]:text-brand-primary [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-brand-ink [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-brand-ink [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-brand-ink [&_ul]:list-disc [&_ul]:pl-5";

export function RequestDetailsHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={`${PROSE}${className ? ` ${className}` : ""}`}
      dangerouslySetInnerHTML={{ __html: sanitiseListingHtml(html) }}
    />
  );
}
