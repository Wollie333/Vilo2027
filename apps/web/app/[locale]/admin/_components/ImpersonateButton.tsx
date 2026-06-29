"use client";

import { ExternalLink } from "lucide-react";
import { useTransition } from "react";

import { startImpersonationAction } from "@/app/[locale]/admin/impersonation/actions";

/**
 * Starts a real impersonation session (sets the signed cookie via
 * startImpersonationAction) BEFORE navigating to /admin/as/<id>, then the action
 * redirects there. Replaces the old plain links that jumped straight to the
 * /admin/as route without a session — which always bounced to no-access. A reason
 * is required (logged to admin_audit_log).
 */
export function ImpersonateButton({
  userId,
  label = "View as user",
  className,
}: {
  userId: string;
  label?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const reason = window.prompt(
          "Reason for viewing as this user (recorded in the audit log):",
        );
        if (!reason || !reason.trim()) return;
        const fd = new FormData();
        fd.set("targetUserId", userId);
        fd.set("reason", reason.trim());
        start(() => {
          void startImpersonationAction(fd);
        });
      }}
      className={className}
    >
      <ExternalLink className="h-4 w-4" /> {pending ? "Starting…" : label}
    </button>
  );
}
