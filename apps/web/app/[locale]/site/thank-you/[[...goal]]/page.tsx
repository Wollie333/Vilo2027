import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SafariShell } from "@/components/site/safari/SafariShell";
import { SafariThankYouContent } from "@/components/site/safari/pages/SafariThankYouContent";
import { SiteChrome } from "@/components/site/SiteChrome";
import {
  SectionShell,
  SectionHeading,
  Muted,
} from "@/components/site/sections/_shared";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { buildSafariNav } from "@/lib/site/safariNav";
import {
  buildSitePreviewPages,
  loadSiteContext,
  resolveSiteRef,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { siteSurfaceIsDark } from "@/lib/site/themes";
import { createAdminClient } from "@/lib/supabase/admin";
import { formSettingsSchema } from "@/lib/website/forms.schema";

export const dynamic = "force-dynamic";

type SP = {
  site?: string;
  preview?: string;
  theme?: string;
  /** The form whose copy to show (for the host's success message override). */
  form?: string;
  /** Optional first name of the visitor, for a warmer heading. */
  name?: string;
};

/**
 * Conversion-goal thank-you templates. One per form GOAL (not per form), each a
 * clean, distinct URL so a Meta Pixel conversion can be wired per page later. The
 * `event` is the standard pixel event this page will fire (slice: pixel).
 */
const GOALS = {
  general: {
    eyebrow: "Message received",
    heading: "Thank you",
    message: "We've got your message and a real person will reply soon.",
    event: "Lead",
  },
  enquiry: {
    eyebrow: "Message received",
    heading: "Thank you",
    message: "We've got your enquiry — a real person will reply soon.",
    event: "Lead",
  },
  quote: {
    eyebrow: "Quote requested",
    heading: "Thanks",
    message: "We'll put your quote together and be in touch shortly.",
    event: "Lead",
  },
  subscribe: {
    eyebrow: "You're on the list",
    heading: "You're subscribed",
    message: "You're on the list — look out for the occasional note from us.",
    event: "Subscribe",
  },
} as const;

type Goal = keyof typeof GOALS;

function resolveGoal(seg?: string[]): Goal {
  const g = seg?.[0];
  return g && g in GOALS ? (g as Goal) : "general";
}

/**
 * Standalone form thank-you page (the form posts, then redirects here). Sibling
 * to the booking thank-you (`book/thank-you`) — same themed design, different
 * info, with copy tailored to the form's conversion goal (path segment).
 */
export default async function SiteFormThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ goal?: string[] }>;
  searchParams: Promise<SP>;
}) {
  const { goal: goalSeg } = await params;
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-vilo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();

  const preview = sp?.preview === "1";
  const ctx = await loadSiteContext(ref, { preview, themeSlug: sp?.theme });
  if (!ctx) notFound();

  const goal = resolveGoal(goalSeg);
  const goalCopy = GOALS[goal];
  const firstName = sp?.name?.trim().slice(0, 60) || null;

  // The host's per-form copy overrides the goal defaults.
  let message: string = goalCopy.message;
  let headingOverride = "";
  const formId = sp?.form?.trim();
  if (formId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("website_forms")
      .select("settings")
      .eq("id", formId)
      .eq("website_id", ctx.websiteId)
      .is("deleted_at", null)
      .maybeSingle<{ settings: unknown }>();
    if (data) {
      const settings = formSettingsSchema.parse(data.settings ?? {});
      if (settings.successMessage) message = settings.successMessage;
      headingOverride = settings.thankYouHeading;
    }
  }

  const heading =
    headingOverride ||
    (firstName ? `${goalCopy.heading}, ${firstName}` : goalCopy.heading);

  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;

  if ((ctx.previewThemeSlug ?? ctx.theme.preset) === "safari") {
    const nav = buildSafariNav(ctx);
    const navLinks = nav.links;
    const bookHref =
      ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined;
    return (
      <SafariShell
        brandName={ctx.brand.name}
        nav={nav}
        bookHref={bookHref}
        previewPages={previewPages}
        analytics={ctx.analytics}
        interactive={!ctx.preview}
      >
        <SafariThankYouContent
          state="form"
          firstName={firstName}
          eyebrow={goalCopy.eyebrow}
          headingText={heading}
          message={message}
          homeHref={
            navLinks.find((l) => /^home$/i.test(l.label))?.href ||
            navLinks[0]?.href
          }
          contactHref={navLinks.find((l) => /contact/i.test(l.label))?.href}
          roomsHref={navLinks.find((l) => /suite|room/i.test(l.label))?.href}
        />
      </SafariShell>
    );
  }

  // Generic themes — the themed shell + a centred confirmation card.
  return (
    <SiteThemeRoot theme={ctx.theme}>
      <SiteChrome
        brand={ctx.brand}
        nav={ctx.nav}
        navigation={ctx.navigation}
        conversion={ctx.conversion}
        analytics={ctx.analytics}
        layout={ctx.layout}
        popupForm={ctx.popupForm}
        websiteId={ctx.websiteId}
        bookHref={
          ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined
        }
        darkChrome={siteSurfaceIsDark(ctx.theme)}
        header={ctx.theme.header}
        footer={ctx.theme.footer}
        preview={
          ctx.preview
            ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
            : undefined
        }
        previewPages={previewPages}
      >
        <SectionShell width="narrow">
          <SectionHeading className="mb-3">{heading}</SectionHeading>
          <Muted className="text-center text-base">{message}</Muted>
        </SectionShell>
      </SiteChrome>
    </SiteThemeRoot>
  );
}
