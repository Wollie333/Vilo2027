// Verified-partner badge — a small scalloped seal with a check. Vector, so it
// stays crisp at any size. Green by default (brand.primary); pass a className to
// resize. Used on a partner's profile and anywhere their name is shown once an
// admin has verified them.
export function VerifiedBadge({
  className = "h-4 w-4",
  title = "Verified partner",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* Scalloped seal — a rounded 10-lobe rosette. */}
      <path
        d="M12 1.6l2.06 1.34 2.45-.28 1.02 2.24 2.24 1.02-.28 2.45L20.4 12l1.34 2.06-.28 2.45-2.24 1.02-1.02 2.24-2.45-.28L12 22.4l-2.06-1.34-2.45.28-1.02-2.24-2.24-1.02.28-2.45L3.6 12 2.26 9.94l.28-2.45 2.24-1.02 1.02-2.24 2.45.28L12 1.6z"
        fill="#10B981"
        stroke="#10B981"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Check */}
      <path
        d="M8.2 12.3l2.5 2.5 5-5.2"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
