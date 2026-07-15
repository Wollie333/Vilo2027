import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildRequirementCategories,
  getLookingForRequirements,
} from "@/lib/looking-for/requirements";

// Read-only grouped display of a request's admin-managed requirement selections
// (Property type, Facilities…). Self-contained server component: fetches the
// post's selected keys + the published catalog, renders only groups with a pick.
export async function RequestRequirements({
  postId,
  title = "Requirements",
  className,
  variant = "full",
}: {
  postId: string;
  title?: string;
  className?: string;
  // "full" = grouped with per-group headers; "compact" = one flat wrap of option
  // chips (no title, no headers) for embedding inside the horizontal info card.
  variant?: "full" | "compact";
}) {
  const admin = createAdminClient();
  const [{ data: rows }, catalog] = await Promise.all([
    admin
      .from("looking_for_post_requirements")
      .select("option_key")
      .eq("post_id", postId),
    getLookingForRequirements(),
  ]);

  const keys = (rows ?? []).map((r) => r.option_key as string);
  const categories = buildRequirementCategories(catalog, keys);
  if (categories.length === 0) return null;

  if (variant === "compact") {
    return (
      <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
        {categories.flatMap((cat) =>
          cat.options.map((o) => (
            <span
              key={`${cat.slug}-${o.slug}`}
              className="rounded-pill border border-brand-line bg-brand-light/50 px-2.5 py-1 text-xs font-medium text-brand-ink"
            >
              {o.label}
            </span>
          )),
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {title ? (
        <h2 className="mb-2 text-sm font-medium text-brand-mute">{title}</h2>
      ) : null}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.slug}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
              {cat.label}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {cat.options.map((o) => (
                <span
                  key={o.slug}
                  className="rounded-pill border border-brand-line bg-brand-light/50 px-2.5 py-1 text-xs font-medium text-brand-ink"
                >
                  {o.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
