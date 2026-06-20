import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

type Props = Extract<WebsiteSection, { type: "hero" }>["props"];

/** Shared headline + subheadline + CTA. `onDark` flips text to white when it
 *  sits over a darkened image; alignment follows the per-section align prop. */
function HeroInner({
  props,
  onDark,
  alignLeft,
}: {
  props: Props;
  onDark: boolean;
  alignLeft: boolean;
}) {
  return (
    <>
      <h1
        style={{
          fontFamily: "var(--site-font-heading)",
          fontWeight: "var(--site-weight-heading)" as unknown as number,
          fontSize: "var(--site-h1)",
          lineHeight: "var(--site-leading-heading)" as unknown as number,
          letterSpacing: "var(--site-tracking-heading)",
          color: onDark ? "#FFFFFF" : "var(--site-ink)",
        }}
      >
        {props.headline}
      </h1>
      {props.subheadline ? (
        <p
          style={{
            color: onDark ? "rgba(255,255,255,0.9)" : "var(--site-mute)",
          }}
          className="mt-5 text-lg md:text-xl"
        >
          {props.subheadline}
        </p>
      ) : null}
      {props.cta_label && props.cta_href ? (
        <div
          className="mt-8 flex"
          style={{ justifyContent: alignLeft ? "flex-start" : "center" }}
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
    </>
  );
}

export function HeroSection({
  props,
  asset,
}: {
  props: Props;
  asset?: SiteAssetResolver;
}) {
  const bg = asset?.(props.image_path) ?? props.image_path ?? undefined;
  const alignLeft = props.align === "left";
  const variant = props.variant ?? "classic";

  // SPLIT — text beside the image (stacks on mobile); text uses theme colours.
  if (variant === "split") {
    return (
      <section style={{ background: "var(--site-surface)" }}>
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-2 md:gap-12 md:py-20">
          <div style={{ textAlign: alignLeft ? "left" : "center" }}>
            <HeroInner props={props} onDark={false} alignLeft={alignLeft} />
          </div>
          {bg ? (
            <div
              aria-hidden
              className="order-first h-56 w-full md:order-last md:h-[26rem]"
              style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderRadius: "var(--site-img-radius)",
              }}
            />
          ) : null}
        </div>
      </section>
    );
  }

  // MINIMAL — no image, compact padding, theme surface.
  if (variant === "minimal") {
    return (
      <section
        style={{ background: "var(--site-surface)" }}
        className="px-5 py-14 md:py-20"
      >
        <div
          className="mx-auto w-full max-w-3xl"
          style={{ textAlign: alignLeft ? "left" : "center" }}
        >
          <HeroInner props={props} onDark={false} alignLeft={alignLeft} />
        </div>
      </section>
    );
  }

  // CLASSIC (default) — full-bleed background image (or surface) with overlay.
  return (
    <section
      style={
        bg
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.42)), url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: "var(--site-surface)" }
      }
      className="px-5 py-24 md:py-32"
    >
      <div
        className="mx-auto w-full max-w-4xl"
        style={{ textAlign: alignLeft ? "left" : "center" }}
      >
        <HeroInner props={props} onDark={Boolean(bg)} alignLeft={alignLeft} />
      </div>
    </section>
  );
}
