import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { resolveHelpIcon } from "@/lib/help/icon-map";
import type { HelpCategoryWithCount } from "@/lib/help/types";

type Props = {
  categories: HelpCategoryWithCount[];
  basePath: string;
};

export function TopicsGrid({ categories, basePath }: Props) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Browse topics
          </div>
          <h3 className="mt-1 font-display text-xl font-bold text-brand-ink">
            Pick a category
          </h3>
        </div>
        <Link
          href={`${basePath}/articles`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-secondary"
        >
          All articles <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-card border border-dashed border-brand-line bg-white px-5 py-10 text-center text-sm text-brand-mute">
          No categories published yet. Admins can add them under{" "}
          <code className="font-mono">/admin/help/categories</code>.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-4">
          {categories.map((c) => {
            const Icon = resolveHelpIcon(c.icon);
            return (
              <Link
                key={c.id}
                href={`${basePath}/category/${c.slug}`}
                className="block rounded-card border border-brand-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-lift"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-accent text-brand-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mt-4 font-display text-sm font-semibold text-brand-ink">
                  {c.name}
                </h4>
                {c.description ? (
                  <p className="mt-1 text-xs leading-snug text-brand-mute">
                    {c.description}
                  </p>
                ) : null}
                <div className="mt-3 font-mono text-[11px] text-brand-mute">
                  {c.article_count} article{c.article_count === 1 ? "" : "s"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
