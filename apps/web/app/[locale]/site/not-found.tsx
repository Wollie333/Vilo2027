// Standalone-ish 404 for tenant sites — neutral, no app chrome and no --site-*
// theme (the site couldn't be resolved).
export default function SiteNotFound() {
  return (
    <div
      style={{ minHeight: "60vh" }}
      className="flex flex-col items-center justify-center gap-2 px-6 py-24 text-center"
    >
      <h1 className="text-2xl font-semibold text-neutral-800">
        Page not found
      </h1>
      <p className="text-sm text-neutral-500">
        This page may have moved, or the site isn’t published yet.
      </p>
    </div>
  );
}
