"use client";

import { ExternalLink } from "lucide-react";
import { useTransition } from "react";

import { modal } from "@/components/ui/modal-host";
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
      onClick={async () => {
        const reason = await modal.prompt({
          title: "View as this user?",
          description:
            "You'll act as this user until you exit. This is recorded in the audit log.",
          label: "Reason (recorded in the audit log)",
          placeholder: "Why do you need to view as this user?",
          minLength: 1,
          confirmLabel: "Start session",
        });
        if (!reason) return;
        const fd = new FormData();
        fd.set("targetUserId", userId);
        fd.set("reason", reason);
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
