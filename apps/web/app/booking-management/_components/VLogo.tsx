type Size = "sm" | "md";

export function VLogo({
  size = "md",
  gradientId,
}: {
  size?: Size;
  gradientId: string;
}) {
  const px = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  return (
    <svg
      className={`${px} rounded-md`}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={`url(#${gradientId})`} />
      {size === "md" ? (
        <>
          <path
            d="M50 76L20 32H36L50 56L64 32H80L50 76Z"
            fill="white"
            opacity="0.4"
          />
          <path
            d="M50 66L26 32H38L50 50L62 32H74L50 66Z"
            fill="white"
            opacity="0.7"
          />
          <path d="M50 56L32 32H40L50 46L60 32H68L50 56Z" fill="white" />
        </>
      ) : (
        <path d="M50 56L32 32H40L50 46L60 32H68L50 56Z" fill="white" />
      )}
    </svg>
  );
}
