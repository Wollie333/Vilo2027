import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { ServiceEditor, type EditorService } from "../ServiceEditor";

export const dynamic = "force-dynamic";

export default async function AdminServiceEditorPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("subscriptions.edit");
  const isNew = params.id === "new";

  let svc: EditorService;
  if (isNew) {
    svc = {
      id: null,
      name: "",
      description: "",
      billingType: "one_time",
      price: 0,
      currency: "ZAR",
      billingCycle: "monthly",
      isActive: true,
      sortOrder: 0,
    };
  } else {
    const service = createAdminClient();
    const { data } = await service
      .from("platform_services")
      .select(
        "id, name, description, billing_type, price, currency, billing_cycle, is_active, sort_order",
      )
      .eq("id", params.id)
      .maybeSingle();
    if (!data) notFound();
    svc = {
      id: data.id,
      name: data.name,
      description: data.description ?? "",
      billingType:
        (data.billing_type as EditorService["billingType"]) ?? "one_time",
      price: Number(data.price ?? 0),
      currency: data.currency ?? "ZAR",
      billingCycle:
        (data.billing_cycle as EditorService["billingCycle"]) ?? "monthly",
      isActive: data.is_active ?? true,
      sortOrder: data.sort_order ?? 0,
    };
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/subscriptions/services"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" /> All services
      </Link>
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {isNew ? "New service" : `Edit ${svc.name}`}
        </h1>
      </header>
      <ServiceEditor service={svc} isNew={isNew} />
    </div>
  );
}
