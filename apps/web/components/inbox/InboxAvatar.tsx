// Shared inbox avatar — image when we have one, otherwise tinted initials.
// One avatar style across the host inbox and the guest portal so the message
// centre looks the same everywhere (single source of truth).

function initialsOf(name: string | null, fallback = "?"): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+|@|\./)
    .filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return letters || fallback;
}

export function InboxAvatar({
  name,
  imageUrl = null,
  size = 48,
  tintClass = "bg-brand-secondary text-white",
  fallback = "?",
  className = "",
}: {
  name: string | null;
  imageUrl?: string | null;
  size?: number;
  tintClass?: string;
  fallback?: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? ""}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  const fontSize =
    size >= 44 ? "text-[14px]" : size >= 32 ? "text-[11px]" : "text-[10px]";
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${tintClass} ${fontSize} ${className}`}
    >
      {initialsOf(name, fallback)}
    </span>
  );
}
