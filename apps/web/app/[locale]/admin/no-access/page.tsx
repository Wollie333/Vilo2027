import type { Metadata } from "next";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "No access · Admin",
};

// Landing page for permission denials surfaced by requirePermission()
// — see lib/admin/requirePermission.ts. The redirect carries:
//   ?key=<permission_key>   the permission that was missing
//   ?reason=rpc_error       optional, set when the underlying RPC errored
//                           (function missing, AAL2 still enforced, etc.)
export default function NoAccessPage({
  searchParams,
}: {
  searchParams?: { key?: string; reason?: string };
}) {
  const key = searchParams?.key ?? null;
  const isRpcError = searchParams?.reason === "rpc_error";

  return (
    <div className="mx-auto max-w-xl space-y-5 py-10">
      <div className="flex items-start gap-3 rounded-card border border-amber-500/40 bg-amber-500/5 p-5">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold text-brand-ink">
            You don&rsquo;t have access to this page
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            {isRpcError
              ? "The permission check failed at the database layer. The server logs have the exact error."
              : "Your admin role doesn't include the permission this page needs."}
            {key ? (
              <>
                {" "}
                Missing permission:{" "}
                <code className="rounded bg-brand-light px-1.5 py-0.5 font-mono text-[12px] text-brand-ink">
                  {key}
                </code>
                .
              </>
            ) : null}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-[12px] font-medium text-brand-primary">
              If you should have access, check this
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-brand-mute">
              <li>
                Migration{" "}
                <code className="font-mono">
                  20260525000009_relax_admin_aal_premvp
                </code>{" "}
                has been applied — it drops the AAL2 (MFA) requirement from{" "}
                <code className="font-mono">has_admin_permission()</code> so the
                pre-MVP build (no MFA enrolment page) can reach this UI.
              </li>
              <li>
                Your <code className="font-mono">platform_staff</code> row
                exists with <code className="font-mono">is_active = true</code>{" "}
                and the right <code className="font-mono">role_id</code>{" "}
                (super_admin gets everything).
              </li>
              <li>
                The <code className="font-mono">admin_role_permissions</code>{" "}
                table has been seeded — migration{" "}
                <code className="font-mono">
                  20260525000002_create_platform_staff_rbac
                </code>{" "}
                handles this.
              </li>
            </ul>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
