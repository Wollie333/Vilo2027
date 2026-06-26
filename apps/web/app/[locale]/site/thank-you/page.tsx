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
  /** The form whose success message to show. */
  form?: string;
  /** Optional first name of the visitor, for a warmer heading. */
  name?: string;
};

/**
 * Standalone "thank you" page shown AFTER a website form is submitted (the form
 * posts, then redirects here). Sibling to the booking thank-you (`book/thank-you`)
 * — same themed design, different info: a confirmation message instead of booking
 * details. Renders the Safari design on a Safari site; the themed generic shell
 * otherwise.
 */
export default async function SiteFormThankYouPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
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

  const firstName = sp?.name?.trim().slice(0, 60) || null;

  // Resolve the host's configured copy + the form TYPE for this submission, so
  // the page responds to where the visitor came from. Defaults apply when no
  // form id is passed or it isn't this site's.
  let message: string | null = null;
  let formType: "contact" | "custom" | "newsletter" = "contact";
  let headingOverride = "";
  const formId = sp?.form?.trim();
  if (formId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("website_forms")
      .select("type, settings")
      .eq("id", formId)
      .eq("website_id", ctx.websiteId)
      .is("deleted_at", null)
      .maybeSingle<{ type: string; settings: unknown }>();
    if (data) {
      const settings = formSettingsSchema.parse(data.settings ?? {});
      message = settings.successMessage;
      headingOverride = settings.thankYouHeading;
      if (
        data.type === "newsletter" ||
        data.type === "custom" ||
        data.type === "contact"
      ) {
        formType = data.type;
      }
    }
  }

  // Copy tailored to the form type (unless the host set a heading override).
  const isNewsletter = formType === "newsletter";
  const eyebrow = isNewsletter ? "You're on the list" : "Message received";
  const heading =
    headingOverride ||
    (isNewsletter
      ? firstName
        ? `You're subscribed, ${firstName}`
        : "You're subscribed"
      : firstName
        ? `Thank you, ${firstName}`
        : "Thank you");
  const defaultMessage = isNewsletter
    ? "You're on the list — look out for the occasional note from us."
    : "We've got your message and a real person will reply soon.";

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
      >
        <SafariThankYouContent
          state="form"
          firstName={firstName}
          eyebrow={eyebrow}
          headingText={heading}
          message={message || defaultMessage}
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
          <Muted className="text-center text-base">
            {message || defaultMessage}
          </Muted>
        </SectionShell>
      </SiteChrome>
    </SiteThemeRoot>
  );
}
