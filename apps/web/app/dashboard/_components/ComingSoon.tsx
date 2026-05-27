import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  tagline,
  phase,
  bullets,
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  phase: string;
  bullets: string[];
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-brand-mute">{tagline}</p>
      </header>

      <section className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          Coming in {phase}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          The surface is live so the navigation makes sense — the feature itself
          lands when its slice ships per{" "}
          <code className="rounded-sm bg-brand-accent px-1.5 py-0.5 font-mono text-[11px] text-brand-primary">
            PHASE_PLAN.md
          </code>
          .
        </p>

        <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-brand-dark">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-pill bg-brand-primary" />
              {b}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
