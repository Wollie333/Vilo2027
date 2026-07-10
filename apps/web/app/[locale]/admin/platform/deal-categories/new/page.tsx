import { requirePermission } from "@/lib/admin";

import { DealCategoryEditor } from "../DealCategoryEditor";

export const dynamic = "force-dynamic";

export default async function NewDealCategoryPage() {
  await requirePermission("taxonomy.manage");
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000";

  return (
    <DealCategoryEditor
      isNew
      initial={{
        id,
        key: "",
        label: "",
        description: "",
        icon: "Sparkles",
        sortOrder: 100,
        isActive: true,
        metaTitle: "",
        metaDescription: "",
        ogImageUrl: "",
        introMarkdown: "",
      }}
    />
  );
}
