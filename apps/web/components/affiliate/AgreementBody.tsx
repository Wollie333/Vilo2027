import {
  agreementParagraphs,
  isAgreementHtml,
} from "@/lib/affiliate/agreement.shared";

// Renders an affiliate agreement body (already {brand}-resolved). New terms are
// authored in the WYSIWYG editor and stored as HTML — rendered as markup here;
// legacy plain-text terms still render as paragraphs. The HTML is admin-authored
// (only staff can write affiliate_settings) and produced by the editor's
// StarterKit, so it is a safe tag subset — the same trust model as the DB-backed
// legal documents the app already renders.
const PROSE =
  "text-[13px] leading-relaxed text-brand-mute [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-brand-ink [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-[13.5px] [&_h3]:font-bold [&_h3]:text-brand-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_strong]:font-semibold [&_strong]:text-brand-ink [&_p]:my-2 [&_a]:text-brand-primary [&_a]:underline [&_a]:underline-offset-2";

export function AgreementBody({
  rendered,
  className,
}: {
  rendered: string;
  className?: string;
}) {
  if (isAgreementHtml(rendered)) {
    return (
      <div
        className={`${PROSE} ${className ?? ""}`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    );
  }
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {agreementParagraphs(rendered).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
