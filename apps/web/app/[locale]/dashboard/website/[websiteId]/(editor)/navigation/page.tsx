import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import { navigationSchema } from "@/app/[locale]/dashboard/website/schemas";

import { NavigationForm } from "./NavigationForm";

export const dynamic = "force-dynamic";

export default async function WebsiteNavigationPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const t = await getTranslations("website");

  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) notFound();

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, navigation")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) notFound();

  const navigation = navigationSchema.parse(site.navigation ?? {});

  return (
    <div className="max-w-2xl">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("navHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("navSub")}</p>
      </header>

      <NavigationForm websiteId={websiteId} initial={navigation} />
    </div>
  );
}
