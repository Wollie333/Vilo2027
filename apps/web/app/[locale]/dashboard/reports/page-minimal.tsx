import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Analytics & Reports",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/reports");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id, display_name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Analytics & Reports
        </h1>
        <p className="mb-4 text-gray-600">
          Page is loading successfully. All stub functions are working.
        </p>
        <div className="rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            <strong>Status:</strong> Analytics functions installed and working.
            <br />
            <strong>Host ID:</strong> {host.id}
            <br />
            <strong>Host Name:</strong> {host.display_name}
          </p>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          If you see this message, the page loads successfully and there are no
          server-side errors.
        </p>
      </div>
    </div>
  );
}
