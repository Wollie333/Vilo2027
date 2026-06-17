import { Check, FileText, Home, BedDouble, Newspaper } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadWebsiteEditorData } from "./loadWebsiteEditorData";

export const dynamic = "force-dynamic";

export default async function WebsiteOverviewPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
  ]);
  if (!data) notFound();

  const steps = [
    { key: "stepBrandTitle", done: Boolean(data.brand.logo_path) },
    { key: "stepThemeTitle", done: Boolean(data.theme.accent) },
    { key: "stepPagesTitle", done: data.counts.pages > 0 },
    { key: "stepRoomsTitle", done: data.counts.rooms > 0 },
    { key: "stepPublishTitle", done: data.status === "published" },
  ];

  const counts = [
    { key: "countPages", value: data.counts.pages, icon: FileText },
    { key: "countProperties", value: data.counts.properties, icon: Home },
    { key: "countRooms", value: data.counts.rooms, icon: BedDouble },
    { key: "countPosts", value: data.counts.posts, icon: Newspaper },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      {/* Set-up checklist */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("checklistTitle")}
        </h2>
        <ul className="mt-4 space-y-2.5">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    s.done
                      ? "bg-brand-primary text-white"
                      : "border border-brand-line text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span
                  className={`text-sm ${s.done ? "text-brand-mute line-through" : "font-medium text-brand-ink"}`}
                >
                  {t(s.key)}
                </span>
              </div>
              <span
                className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  s.done
                    ? "bg-brand-accent text-brand-secondary"
                    : "bg-brand-light text-brand-mute"
                }`}
              >
                {s.done ? t("stepDone") : t("stepTodo")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Counts */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("tabOverview")}
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {counts.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.key}
                className="rounded-card border border-brand-line bg-brand-light/40 p-4"
              >
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
                  <Icon className="h-3.5 w-3.5" />
                  {t(c.key)}
                </dt>
                <dd className="mt-1 font-display text-2xl font-bold text-brand-ink">
                  {c.value}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
}
