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
