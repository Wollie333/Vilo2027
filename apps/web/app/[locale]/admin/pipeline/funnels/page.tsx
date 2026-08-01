import { ArrowLeft, FileText, Film, Users, Workflow } from "lucide-react";
import Link from "next/link";

import { requirePermission } from "@/lib/admin/requirePermission";
import { type Audience, getFunnels } from "@/lib/pipeline/queries";

import { FunnelPageLinks } from "./_components/FunnelPageLinks";

export const dynamic = "force-dynamic";

const AUDIENCE_META: Record<Audience, { label: string; dot: string }> = {
  host: { label: "Hosts", dot: "#10B981" },
  affiliate: { label: "Affiliates", dot: "#6366F1" },
};

export default async function FunnelsDirectoryPage() {
  await requirePermission("pipeline.view");
  const funnels = await getFunnels();

  return (
    <div className="mx-auto max-w-[860px]">
      <Link
        href="/admin/pipeline"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-mute transition hover:text-brand-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to pipeline
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent text-brand-secondary">
          <Workflow className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em]">
            Landing pages
          </h1>
          <p className="mt-0.5 text-[13.5px] text-brand-mute">
            The public funnel pages that feed the pipeline. Open or copy a URL
            to run ads or share it — every submission lands on the matching
            board.
          </p>
        </div>
      </div>

      {funnels.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-brand-line bg-white p-10 text-center">
          <p className="text-[14px] font-semibold">No funnels yet</p>
          <p className="mt-1 text-[13px] text-brand-mute">
            Funnel pages are seeded via migrations.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {funnels.map((f) => {
            const am = AUDIENCE_META[f.audience];
            return (
              <section
                key={f.id}
                className="rounded-card border border-brand-line bg-white p-5 shadow-card"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: am.dot }}
                  />
                  <h2 className="font-display text-[17px] font-extrabold tracking-tight">
                    {f.name}
                  </h2>
                  <span className="rounded-full border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
                    {am.label}
                  </span>
                  {f.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#B7E9CE] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-brand-secondary">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
                      Inactive
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-mute">
                    <Users className="h-3.5 w-3.5" />
                    {f.leadCount} {f.leadCount === 1 ? "lead" : "leads"}
                  </span>
                </div>

                {f.headline ? (
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-brand-ink">
                    {f.headline}
                  </p>
                ) : null}

                {/* URLs */}
                <div className="mt-4">
                  <FunnelPageLinks slug={f.slug} />
                </div>

                {/* Resource status */}
                <div className="mt-3.5 flex flex-wrap gap-2 border-t border-brand-line pt-3.5">
                  <ResourceChip
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label="Brochure"
                    set={f.hasBrochure}
                    detail={f.brochureName}
                  />
                  <ResourceChip
                    icon={<Film className="h-3.5 w-3.5" />}
                    label="Video"
                    set={f.hasVideo}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResourceChip({
  icon,
  label,
  set,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  set: boolean;
  detail?: string | null;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${
        set
          ? "border-[#B7E9CE] bg-[#ECFDF5] text-brand-secondary"
          : "border-brand-line bg-brand-light text-brand-mute"
      }`}
    >
      {icon}
      {label}:{" "}
      <b className="font-semibold">{set ? detail || "set" : "not set"}</b>
    </span>
  );
}
