import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell } from "./_shared";

type Props = Extract<WebsiteSection, { type: "rich_text" }>["props"];

// `props.html` is expected to be ALREADY sanitised by the server loader
// (reuse sanitiseListingHtml in W4) — this component is pure presentational.
export function RichTextSection({ props }: { props: Props }) {
  return (
    <SectionShell width="narrow">
      <div
        style={{ color: "var(--site-ink)" }}
        className="site-prose space-y-4 text-base leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: props.html }}
      />
    </SectionShell>
  );
}
