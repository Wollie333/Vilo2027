import { Link } from "@/i18n/navigation";

// Locale-scoped 404 boundary. Renders inside [locale]/layout (which provides
// <html>/<body> + providers), so it's the not-found target for notFound() calls
// in the locale tree — including the invalid-locale guard in layout.tsx.
export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
        404
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-brand-mute">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
      >
        Back home
      </Link>
    </main>
  );
}
