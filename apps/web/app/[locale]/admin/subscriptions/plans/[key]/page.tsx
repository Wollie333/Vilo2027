import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { getAllPlans } from "@/lib/plans/getPlans";

import { PlanEditor, type EditorPlan } from "../PlanEditor";

export const dynamic = "force-dynamic";

export default async function AdminPlanEditorPage({
  params,
}: {
  params: { key: string };
}) {
  await requirePermission("subscriptions.edit");
  const isNew = params.key === "new";

  let plan: EditorPlan;
  if (isNew) {
    plan = {
      key: "",
      name: "",
      tagline: "",
      description: "",
      currency: "ZAR",
      trialDays: 14,
      isFree: false,
      isActive: true,
      isRecommended: false,
      bullets: [],
      sortOrder: 0,
      monthly: 0,
      annual: 0,
    };
  } else {
    const all = await getAllPlans();
    const found = all.find((p) => p.key === params.key);
    if (!found) notFound();
    plan = {
      key: found.key,
      name: found.name,
      tagline: found.tagline,
      description: found.description ?? "",
      currency: found.currency,
      trialDays: found.trialDays,
      isFree: found.isFree,
      isActive: found.isActive,
      isRecommended: found.recommended,
      bullets: found.bullets,
      sortOrder: found.sortOrder,
      monthly: found.monthly,
      annual: found.annual,
    };
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/subscriptions/plans"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All plans
      </Link>
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {isNew ? "New plan" : `Edit ${plan.name}`}
        </h1>
      </header>
      <PlanEditor plan={plan} isNew={isNew} />
    </div>
  );
}
