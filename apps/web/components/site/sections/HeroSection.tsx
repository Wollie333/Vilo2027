import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

type Props = Extract<WebsiteSection, { type: "hero" }>["props"];

export function HeroSection({
  props,
  asset,
}: {
  props: Props;
  asset?: SiteAssetResolver;
}) {
  const bg = asset?.(props.image_path) ?? props.image_path ?? undefined;

  return (
    <section
      style={
        bg
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.42)), url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: "#FFFFFF",
            }
          : { background: "var(--site-surface)" }
      }
      className="px-5 py-24 md:py-32"
    >
      <div
        className="mx-auto w-full max-w-4xl"
        style={{ textAlign: props.align === "left" ? "left" : "center" }}
      >
        <h1
          style={{
            fontFamily: "var(--site-font-heading)",
            fontWeight: "var(--site-weight-heading)" as unknown as number,
            fontSize: "var(--site-h1)",
            lineHeight: "var(--site-leading-heading)" as unknown as number,
            letterSpacing: "var(--site-tracking-heading)",
            color: bg ? "#FFFFFF" : "var(--site-ink)",
          }}
        >
          {props.headline}
        </h1>
        {props.subheadline ? (
          <p
            style={{ color: bg ? "rgba(255,255,255,0.9)" : "var(--site-mute)" }}
            className="mt-5 text-lg md:text-xl"
          >
            {props.subheadline}
          </p>
        ) : null}
        {props.cta_label && props.cta_href ? (
          <div
            className="mt-8 flex"
            style={{
              justifyContent: props.align === "left" ? "flex-start" : "center",
            }}
          >
            <a
              href={props.cta_href}
              style={{
                background: "var(--site-btn-primary-bg)",
                color: "var(--site-btn-primary-color)",
                border: "var(--site-btn-primary-border)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
              className="inline-flex items-center px-7 py-3.5 text-base font-semibold transition-opacity hover:opacity-90"
            >
              {props.cta_label}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
