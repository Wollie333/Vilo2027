import { redirect } from "next/navigation";

// The legacy "Plans" tab is retired: subscription plans are now the real active
// membership products, shown via the plan filter on the Hosts tab, and edited in
// the canonical Products hub (/admin/products). Redirect any old link here.
export const dynamic = "force-dynamic";

export default function LegacyPlansRedirect() {
  redirect("/admin/subscriptions");
}
