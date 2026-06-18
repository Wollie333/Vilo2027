import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadRoomsEditor } from "./loadRoomsEditor";
import { RoomsManager } from "./RoomsManager";

export const dynamic = "force-dynamic";

export default async function WebsiteRoomsPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadRoomsEditor(websiteId),
  ]);
  if (!data) notFound();

  return (
    <div>
      <header className="mb-5 max-w-2xl">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("roomsHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("roomsSub")}</p>
      </header>

      <RoomsManager
        websiteId={websiteId}
        initialProperties={data.properties}
        preview={data.preview}
      />
    </div>
  );
}
