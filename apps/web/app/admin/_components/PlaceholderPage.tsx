import { Construction } from "lucide-react";

export function PlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: "B" | "C" | "D" | "E";
  description: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">{description}</p>
      </header>

      <div className="flex items-start gap-3 rounded-card border border-dashed border-brand-line bg-white p-5">
        <Construction className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
        <div className="text-[13px] text-brand-mute">
          Ships in{" "}
          <span className="font-semibold text-brand-ink">Phase {phase}</span> of
          the super admin build. The foundation (route guard, RBAC, audit
          logging, impersonation) is already in place; this screen will wire
          onto the existing tables when its domain reaches the build queue.
        </div>
      </div>
    </div>
  );
}
