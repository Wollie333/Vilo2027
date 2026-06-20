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

  // BANNER (default) — full-width centered band.
  return (
    <section
      style={{ background: "var(--site-surface)" }}
      className="px-5 py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-3xl text-center">
        <CtaHeading>{props.heading}</CtaHeading>
        {props.body ? (
          <Muted className="mx-auto mt-3 max-w-lg text-base">
            {props.body}
          </Muted>
        ) : null}
        <div className="mt-7 flex justify-center">
          <SiteButton href={props.button_href}>{props.button_label}</SiteButton>
        </div>
      </div>
    </section>
  );
}
