import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "logos" }>["props"];

function LogoImg({
  url,
  alt,
  mono,
}: {
  url: string;
  alt: string;
  mono: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={`h-10 w-auto max-w-[160px] object-contain md:h-12 ${
        mono
          ? "opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
          : ""
      }`}
    />
  );
}

/** Free-form partner / "as seen in" logo strip. Each logo image is uploaded;
 *  paths resolve to URLs through the shared `asset` resolver. */
export function LogosSection({
  props,
  asset,
}: {
  props: Props;
  asset?: SiteAssetResolver;
}) {
  const logos = props.items.filter((l) => l.image_path);
  if (logos.length === 0) return null;
  const variant = props.variant ?? "row";

  // GRID — logos in bordered cells.
  if (variant === "grid") {
    return (
      <SectionShell>
        {props.heading ? (
          <SectionHeading className="mb-10">{props.heading}</SectionHeading>
        ) : null}
        <div
          className="mx-auto grid max-w-4xl grid-cols-2 gap-px overflow-hidden sm:grid-cols-3 md:grid-cols-4"
          style={{
            background: "var(--site-line)",
            borderRadius: "var(--site-radius)",
          }}
        >
          {logos.map((logo, i) => {
            const url = asset?.(logo.image_path) ?? logo.image_path;
            const img = <LogoImg url={url} alt={logo.alt ?? ""} mono={false} />;
            return (
              <div
                key={i}
                className="flex items-center justify-center p-6"
                style={{ background: "var(--site-surface)" }}
              >
                {logo.href ? (
                  <a href={logo.href} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </div>
            );
          })}
        </div>
      </SectionShell>
    );
  }

  // ROW (grayscale, default) or COLOR (full colour).
  const mono = variant === "row";
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
        {logos.map((logo, i) => {
          const url = asset?.(logo.image_path) ?? logo.image_path;
          const img = <LogoImg url={url} alt={logo.alt ?? ""} mono={mono} />;
          return logo.href ? (
            <a
              key={i}
              href={logo.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {img}
            </a>
          ) : (
            <span key={i}>{img}</span>
          );
        })}
      </div>
    </SectionShell>
  );
}
