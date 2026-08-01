import { ArrowUpRight, BookOpen, Mail, PlayCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Honest, always-true quick actions. The old version rendered fabricated
// "live chat online / median response / N,NNN hosts / system status" stats that
// had no real system behind them — those are hidden until real (founder call).
type Props = {
  basePath: string;
  supportEmail: string;
};

export function QuickActions({ basePath, supportEmail }: Props) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
      <Link
        href={`${basePath}/articles`}
        className="flex items-start gap-4 rounded-card border border-brand-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-primary text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-brand-ink">
            Browse all articles
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-brand-mute">
            Every guide, sorted by topic and freshness.
          </p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-brand-mute" />
      </Link>

      <Link
        href="#videos"
        className="flex items-start gap-4 rounded-card border border-brand-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
          <PlayCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-brand-ink">
            Video tutorials
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-brand-mute">
            Watch a walkthrough instead of reading.
          </p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-brand-mute" />
      </Link>

      <a
        href={`mailto:${supportEmail}`}
        className="flex items-start gap-4 rounded-card border border-brand-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-secondary text-white">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-brand-ink">
            Email support
          </h3>
          <p className="mt-1 truncate text-xs leading-relaxed text-brand-mute">
            {supportEmail}
          </p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-brand-mute" />
      </a>
    </section>
  );
}
