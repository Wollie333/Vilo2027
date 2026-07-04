import { CircleCheck } from "lucide-react";

import { LUCIDE_ICONS } from "@/lib/website/icons/lucideCatalog";
import type { AmenityCategory } from "@/lib/taxonomy/groupAmenities";

export type { AmenityCategory };

/**
 * Category-grouped amenities panel (Booking.com-style): each category shows an
 * accent icon + title header with its amenities as small dot-bulleted rows,
 * flowing into a responsive masonry of columns.
 *
 * Colour is theming-agnostic via CSS custom properties so the SAME component
 * serves the Vilo marketplace (brand green) and a host's own themed site
 * (its accent): a caller sets `--am-accent` / `--am-title` / `--am-text`;
 * unset falls back to Vilo green + brand ink/mute.
 */
export function AmenitiesCategorized({
  categories,
}: {
  categories: AmenityCategory[];
}) {
  const shown = categories.filter((c) => c.items.length > 0);
  if (shown.length === 0) return null;

  return (
    <div
      style={{
        columnWidth: "230px",
        columnGap: "2.5rem",
      }}
    >
      {shown.map((cat) => {
        const Icon = LUCIDE_ICONS[cat.icon] ?? CircleCheck;
        return (
          <section
            key={cat.id}
            style={{
              breakInside: "avoid",
              marginBottom: "1.9rem",
              display: "inline-block",
              width: "100%",
            }}
          >
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                margin: "0 0 0.65rem",
                fontSize: "15px",
                fontWeight: 700,
                color: "var(--am-title, var(--brand-ink, #052e1f))",
              }}
            >
              <Icon
                size={19}
                strokeWidth={1.9}
                style={{
                  flexShrink: 0,
                  color: "var(--am-accent, #10b981)",
                }}
                aria-hidden
              />
              <span>{cat.label}</span>
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {cat.items.map((it) => (
                <li
                  key={it.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    padding: "0.28rem 0",
                    fontSize: "14px",
                    color: "var(--am-text, var(--brand-mute, #4a7c6a))",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      marginTop: "0.5rem",
                      flexShrink: 0,
                      width: "5px",
                      height: "5px",
                      borderRadius: "9999px",
                      background: "var(--am-accent, #10b981)",
                    }}
                  />
                  <span>{it.label}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
