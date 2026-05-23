import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-light text-brand-ink">
      <div
        aria-hidden
        className="absolute inset-0 bg-dot-grid opacity-70 lg:block"
      />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:py-14">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-brand-gradient text-white shadow-glow">
              <span className="font-display text-base font-bold leading-none">
                V
              </span>
            </div>
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-brand-mute">
              Vilo
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-brand-mute transition-colors duration-150 ease-out hover:text-brand-primary"
          >
            ← Back to site
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </main>
  );
}
