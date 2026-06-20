/**
 * Renders a schema.org JSON-LD block as a <script type="application/ld+json">.
 * `<` is escaped so structured data can never break out of the script tag.
 */
export function JsonLd({ graph }: { graph: Record<string, unknown>[] }) {
  if (!graph || graph.length === 0) return null;
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  }).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- serialized, <-escaped JSON-LD
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
