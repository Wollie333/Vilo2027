import { Star } from "lucide-react";

// Small star row used wherever the design shows the 5-pip rating display.
// Reads "rating" rounded to whole stars; halves don't render — keeps it
// faithful to how Supabase stores integer ratings.
export function StarRow({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  const stars = Math.min(5, Math.max(0, Math.round(rating)));
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${stars} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < stars;
        return (
          <Star
            key={i}
            className={`${cls} ${filled ? "fill-amber-400 text-amber-400" : "text-brand-line"}`}
            aria-hidden
          />
        );
      })}
    </span>
  );
}
