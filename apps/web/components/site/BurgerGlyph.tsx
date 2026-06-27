// The mobile ☰ menu icon, shared by every theme (Safari + generic). The host
// configures it in the menu builder's Mobile menu tab (navigation.header.burger);
// the render is identical across themes so a new theme inherits it for free.

export type BurgerConfig = {
  color?: string;
  size?: number;
  weight?: "thin" | "regular" | "bold";
  style?: "lines" | "short" | "dots" | "grid";
  /** Button background behind the icon (applied by the caller, not here). */
  bg?: string;
};

const STROKE: Record<NonNullable<BurgerConfig["weight"]>, number> = {
  thin: 1,
  regular: 1.5,
  bold: 2.5,
};

/**
 * Render the ☰ icon for the chosen glyph: 3 lines (default) / short staggered
 * lines / 3 dots (meatball) / 9-dot grid. Stroke for the line styles, filled
 * circles for the dot styles. Colour/size fall back to the theme's defaults.
 */
export function BurgerGlyph({
  burger,
  fallbackColor = "currentColor",
  fallbackSize = 26,
}: {
  burger?: BurgerConfig;
  fallbackColor?: string;
  fallbackSize?: number;
}) {
  const size = burger?.size ?? fallbackSize;
  const color = burger?.color?.trim() || fallbackColor;
  const weight = STROKE[burger?.weight ?? "regular"];
  const style = burger?.style;

  if (style === "dots") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        {[5, 12, 19].map((cx) => (
          <circle key={cx} cx={cx} cy="12" r="1.8" />
        ))}
      </svg>
    );
  }
  if (style === "grid") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        {[6, 12, 18].flatMap((cy) =>
          [6, 12, 18].map((cx) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />
          )),
        )}
      </svg>
    );
  }
  const d =
    style === "short" ? "M3 6h18M3 12h12M3 18h18" : "M3 6h18M3 12h18M3 18h18";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
    >
      <path d={d} />
    </svg>
  );
}
