// Pure (client-safe) half of the affiliate agreement. Kept out of
// lib/affiliate/agreement.ts because that module is `server-only` and the
// acceptance gate is a client component.
//
// The SNAPSHOT stored at acceptance must be exactly what the partner read, so
// both the gate and the recording action render the body through this one
// function — never their own copy of the substitution.

/** Admin-authored terms with `{brand}` resolved to the live brand name. */
export function renderAgreementBody(
  termsContent: string,
  brand: string,
): string {
  return termsContent.replace(/\{brand\}/g, brand);
}

/** Blank-line-separated paragraphs of the rendered body, for display. */
export function agreementParagraphs(rendered: string): string[] {
  return rendered
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Terms are authored in a rich-text (WYSIWYG) editor and stored as HTML. Older
 * terms were stored as blank-line-separated plain text. This detects the HTML
 * form so a display can render it as markup, while legacy plain text still
 * renders as paragraphs. The block tags below are exactly what the editor's
 * StarterKit can emit.
 */
export function isAgreementHtml(rendered: string): boolean {
  return /<(p|h2|h3|h4|ul|ol|li|strong|em|b|i|a|blockquote|br|hr|pre|code)\b/i.test(
    rendered,
  );
}
