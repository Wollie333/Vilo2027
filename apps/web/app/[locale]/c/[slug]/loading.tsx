export default function LoadingCategory() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <div className="h-64 animate-pulse rounded-card bg-brand-light" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] animate-pulse rounded-card bg-brand-light"
          />
        ))}
      </div>
    </div>
  );
}
