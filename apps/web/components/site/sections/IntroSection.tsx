import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): every variant renders bare (no self <section>/
// band/width-clamp); the SECTION owns padding + width, and the heading is a separate
// Heading element the host places above. `props.heading` stays legacy (kept so
// pre-reframe pages don't lose their title before they're re-seeded).
import { SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "intro" }>["props"];

export function IntroSection({ props }: { props: Props }) {
  const variant = props.variant ?? "centered";

  // STORY — the designed 2-col band: eyebrow + heading + body beside a framed
  // photo with an optional floating stat badge. The photo/badge come from the
  // theme design (image_path / badge_value+label); host data replaces them later.
  if (variant === "story") {
    const showBadge = props.show_badge !== false && !!props.badge_value?.trim();
    return (
      <>
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div>
            {props.eyebrow ? (
              <div
                style={{ color: "var(--site-accent)" }}
                className="mb-3 text-[13px] font-semibold uppercase tracking-[0.18em]"
              >
                {props.eyebrow}
              </div>
            ) : null}
            {props.heading ? (
              <SectionHeading centered={false} className="md:text-4xl">
                {props.heading}
              </SectionHeading>
            ) : null}
            <p
              style={{ color: "var(--site-mute)" }}
              className="mt-5 whitespace-pre-line text-lg leading-relaxed"
            >
              {props.body}
            </p>
          </div>
          {props.image_path ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={props.image_path}
                alt={props.heading ?? ""}
                style={{
                  borderRadius: "var(--site-img-radius, var(--site-radius))",
                  boxShadow: "var(--site-card-shadow)",
                }}
                className="h-full max-h-[30rem] w-full object-cover"
              />
              {showBadge ? (
                <div
                  style={{
                    background: "var(--site-accent)",
                    color: "var(--site-accent-ink)",
                    borderRadius: "var(--site-card-radius, var(--site-radius))",
                    boxShadow: "var(--site-card-shadow)",
                  }}
                  className="absolute -bottom-5 -left-5 px-5 py-3 text-center"
                >
                  <div className="text-2xl font-bold leading-none">
                    {props.badge_value}
                  </div>
                  {props.badge_label ? (
                    <div className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
                      {props.badge_label}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </>
    );
  }

  // SPLIT — heading on the left, body on the right (stacks on mobile).
  if (variant === "split") {
    return (
      <>
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          {props.heading ? (
            <SectionHeading centered={false} className="md:text-3xl">
              {props.heading}
            </SectionHeading>
          ) : (
            <div />
          )}
          <p
            style={{ color: "var(--site-mute)" }}
            className="whitespace-pre-line text-lg leading-relaxed"
          >
            {props.body}
          </p>
        </div>
      </>
    );
  }

  // LEAD — large, light statement paragraph.
  if (variant === "lead") {
    return (
      <>
        {props.heading ? (
          <SectionHeading className="mb-5">{props.heading}</SectionHeading>
        ) : null}
        <p
          style={{ color: "var(--site-ink)" }}
          className="whitespace-pre-line text-center text-2xl font-light leading-snug md:text-3xl"
        >
          {props.body}
        </p>
      </>
    );
  }

  // CENTERED (default).
  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-5">{props.heading}</SectionHeading>
      ) : null}
      <p
        style={{ color: "var(--site-mute)" }}
        className="whitespace-pre-line text-center text-lg leading-relaxed"
      >
        {props.body}
      </p>
    </>
  );
}
