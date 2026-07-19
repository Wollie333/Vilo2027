/**
 * Presets that render the OceansView bespoke page components + chrome — the
 * shared "resort" layout, re-skinned per theme via a `.wielo-<slug>` block.
 *
 * OceansView is the reference. Safari (NenGama Lodge — savanna) and Royal Hotel
 * (grand hotel — champagne/charcoal) reuse the SAME page components + chrome,
 * differing only by their skin block + preset palette/font/radius. Adding a
 * future re-skin theme = one entry here (plus its preset + `.wielo-<slug>` skin).
 *
 * Themes with their OWN bespoke component set (Marmalade, Sabela/hotel) are NOT
 * listed — they branch on their own preset in SitePageView / Site*View.
 */
export function usesOceansViewLayout(preset?: string | null): boolean {
  return preset === "oceansview" || preset === "safari" || preset === "royal";
}
