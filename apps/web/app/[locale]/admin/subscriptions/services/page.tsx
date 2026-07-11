import { redirect } from "next/navigation";

// The Service tab is retired — services now live under the Products tab (filtered
// by category). Redirect any old link here.
export const dynamic = "force-dynamic";

export default function LegacyServicesRedirect() {
  redirect("/admin/subscriptions/products");
}
