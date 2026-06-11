import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

// Dark gradient hero shell for the settings areas. Mirrors the look of the
// /dashboard/setup hero (re-using the shared brand-gradient-dark + dotgrid
// tokens) but drops the wizard-only progress ring / publish button. The tab
// chips render via the `children` slot so the active-state client component
// stays decoupled from this presentational server component.

export function SettingsHero({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-card border border-brand-line shadow-card">
      <div className="relative bg-brand-gradient-dark p-6 text-white md:p-8">
        <div
          aria-hidden
          className="setup-dotgrid pointer-events-none absolute inset-0 opacity-30"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl"
        />

        <div className="relative">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent/80 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </Link>

          <div className="mt-3 max-w-xl">
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-brand-accent/80">
              {subtitle}
            </p>
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
