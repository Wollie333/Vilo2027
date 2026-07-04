import type { ReactNode } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SiteButton, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "cta" }>["props"];

function CtaHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--site-font-heading)",
        color: "var(--site-ink)",
      }}
      className="text-2xl font-semibold tracking-tight md:text-3xl"
    >
      {children}
    </h2>
  );
}

export function CtaSection({ props }: { props: Props }) {
  const variant = props.variant ?? "banner";

  // SPLIT — heading/body on the left, button on the right (stacks on mobile).
  if (variant === "split") {
    return (
      <SectionShell>
        <div
          style={{
            background: "var(--site-surface)",
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius)",
          }}
          className="flex flex-col items-center gap-6 p-8 text-center md:flex-row md:justify-between md:p-10 md:text-left"
        >
          <div>
            <CtaHeading>{props.heading}</CtaHeading>
            {props.body ? (
              <Muted className="mt-2 max-w-xl text-base">{props.body}</Muted>
            ) : null}
          </div>
          <div className="shrink-0">
            <SiteButton href={props.button_href}>
              {props.button_label}
            </SiteButton>
          </div>
        </div>
      </SectionShell>
    );
  }

  // CARD — boxed, centered.
  if (variant === "card") {
    return (
      <SectionShell width="narrow">
        <div
          style={{
            background: "var(--site-surface)",
            borderColor: "var(--site-line)",
            borderRadius: "var(--site-radius)",
          }}
          className="border p-10 text-center"
        >
          <CtaHeading>{props.heading}</CtaHeading>
          {props.body ? (
            <Muted className="mx-auto mt-3 max-w-md text-base">
              {props.body}
            </Muted>
          ) : null}
          <div className="mt-7 flex justify-center">
            <SiteButton href={props.button_href}>
              {props.button_label}
            </SiteButton>
          </div>
        </div>
      </SectionShell>
    );
  }

  // BANNER (default) — full-width centered band. With an image it becomes a
  // full-bleed photo band + dark scrim + light text (the designed closing CTA);
  // without one it's the flat theme surface.
  const onImage = !!props.image_path;
  const bannerStyle = onImage
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url(${props.image_path})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: "var(--site-surface)" };
  return (
    <section
      style={bannerStyle}
      className={onImage ? "px-5 py-24 md:py-32" : "px-5 py-16 md:py-20"}
    >
      <div className="mx-auto w-full max-w-3xl text-center">
        <h2
          style={{
            fontFamily: "var(--site-font-heading)",
            color: onImage ? "#ffffff" : "var(--site-ink)",
          }}
          className="text-2xl font-semibold tracking-tight md:text-3xl"
        >
          {props.heading}
        </h2>
        {props.body ? (
          <p
            style={{
              color: onImage ? "rgba(255,255,255,0.9)" : "var(--site-mute)",
            }}
            className="mx-auto mt-3 max-w-lg text-base"
          >
            {props.body}
          </p>
        ) : null}
        {props.newsletter ? (
          // Newsletter sign-up band (email + subscribe) instead of a link button.
          // Visual for the theme; the footer carries the wired newsletter. Any
          // theme can use it via `newsletter:true`.
          <form className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="you@email.com"
              aria-label="Email"
              style={{
                background: onImage
                  ? "rgba(255,255,255,0.16)"
                  : "var(--site-bg)",
                border: `1px solid ${onImage ? "rgba(255,255,255,0.32)" : "var(--site-line)"}`,
                color: onImage ? "#ffffff" : "var(--site-ink)",
                borderRadius: "var(--site-radius)",
              }}
              className="w-full px-4 py-3 text-sm outline-none"
            />
            <button
              type="button"
              style={{
                background: "var(--site-btn-primary-bg)",
                color: "var(--site-btn-primary-color)",
                border: "var(--site-btn-primary-border)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
              className="shrink-0 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              {props.button_label}
            </button>
          </form>
        ) : (
          <div className="mt-7 flex justify-center">
            <SiteButton href={props.button_href}>
              {props.button_label}
            </SiteButton>
          </div>
        )}
      </div>
    </section>
  );
}
