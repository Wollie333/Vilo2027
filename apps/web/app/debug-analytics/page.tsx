import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DebugAnalyticsPage() {
  const supabase = createServerClient();

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check host
  const { data: host, error: hostError } = await supabase
    .from("hosts")
    .select("id, display_name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Test one RPC call
  let rpcResult = null;
  let rpcError = null;

  if (host) {
    const { data, error } = await supabase.rpc("fetch_primary_kpis", {
      p_host_id: host.id,
      p_start_date: "2024-01-01",
      p_end_date: "2024-12-31",
      p_listing_id: null,
      p_channel: null,
    });
    rpcResult = data;
    rpcError = error;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Analytics Debug Page</h1>

        {/* Environment Check */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Environment Variables</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
                <span className="text-green-600">✓ Set ({process.env.NEXT_PUBLIC_SUPABASE_URL})</span>
              ) : (
                <span className="text-red-600">✗ Missing</span>
              )}
            </div>
            <div>
              <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
                <span className="text-green-600">✓ Set (length: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length})</span>
              ) : (
                <span className="text-red-600">✗ Missing</span>
              )}
            </div>
            <div>
              <strong>SUPABASE_SERVICE_ROLE_KEY:</strong>{" "}
              {process.env.SUPABASE_SERVICE_ROLE_KEY ? (
                <span className="text-green-600">✓ Set (length: {process.env.SUPABASE_SERVICE_ROLE_KEY.length})</span>
              ) : (
                <span className="text-red-600">✗ Missing</span>
              )}
            </div>
          </div>
        </div>

        {/* Auth Check */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Authentication</h2>
          {authError ? (
            <div className="text-red-600">Error: {JSON.stringify(authError)}</div>
          ) : (
            <div className="space-y-2 font-mono text-sm">
              <div><strong>User ID:</strong> {user.id}</div>
              <div><strong>Email:</strong> {user.email}</div>
            </div>
          )}
        </div>

        {/* Host Check */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Host Account</h2>
          {hostError ? (
            <div className="text-red-600">Error: {JSON.stringify(hostError)}</div>
          ) : host ? (
            <div className="space-y-2 font-mono text-sm">
              <div><strong>Host ID:</strong> {host.id}</div>
              <div><strong>Display Name:</strong> {host.display_name}</div>
            </div>
          ) : (
            <div className="text-red-600">✗ No host account found for this user</div>
          )}
        </div>

        {/* RPC Test */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">RPC Function Test</h2>
          <div className="mb-2 text-sm text-gray-600">
            Testing: <code>fetch_primary_kpis</code>
          </div>
          {!host ? (
            <div className="text-yellow-600">Skipped (no host account)</div>
          ) : rpcError ? (
            <div className="space-y-2">
              <div className="text-red-600 font-semibold">✗ RPC Call Failed</div>
              <pre className="overflow-auto rounded bg-red-50 p-4 text-xs">
                {JSON.stringify(rpcError, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-green-600 font-semibold">✓ RPC Call Successful</div>
              <pre className="overflow-auto rounded bg-green-50 p-4 text-xs">
                {JSON.stringify(rpcResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-blue-50 p-6">
          <h3 className="mb-2 font-semibold">Next Steps:</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>If env vars are missing: Add them in Vercel Settings → Environment Variables</li>
            <li>If no host account: Create one at /dashboard/setup</li>
            <li>If RPC fails: Check the error message above for details</li>
            <li>Once fixed, go to <a href="/dashboard/reports" className="text-blue-600 underline">/dashboard/reports</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
