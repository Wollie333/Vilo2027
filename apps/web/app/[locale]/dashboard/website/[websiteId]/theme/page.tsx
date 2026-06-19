import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

// The Theme tab was merged into the Brand Studio (Colours + Typography +
// Buttons & Corners sub-sections). Keep this route as a redirect so old links
// and bookmarks land on the studio.
export default async function WebsiteThemeRedirect({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const locale = await getLocale();
  redirect({
    href: `/dashboard/website/${websiteId}/brand`,
    locale,
  });
}
