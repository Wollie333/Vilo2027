"use client";

import { ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import {
  reportSupportAccessAction,
  respondSupportAccessAction,
} from "@/app/[locale]/dashboard/support-access/actions";

// The popup that appears when the account owner clicks a "Wielo support requested
// access" notification. Accept opens the 24-hour edit window; Decline refuses;
// Report auto-declines AND flags it in the Wielo support inbox thread so staff
// are alerted. Shared by the notification bell + the notifications page.
export function SupportAccessRequestModal({
  open,
  grantId,
  title,
  body,
  onOpenChange,
  onResolved,
}: {
  open: boolean;
  grantId: string | null;
  title?: string;
  body?: string | null;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}) {
  async function run(kind: "approve" | "decline" | "report"): Promise<boolean> {
    if (!grantId) return true;
    const r =
      kind === "report"
        ? await reportSupportAccessAction({ grantId })
        : await respondSupportAccessAction({ grantId, action: kind });
    if (!r.ok) {
      toast.error(r.error);
      return false; // keep the modal open on failure
    }
    toast.success(
      kind === "approve"
        ? "Access approved — Wielo can edit for 24 hours."
        : kind === "report"
          ? "Reported and declined. Wielo has been notified in your inbox."
          : "Request declined.",
    );
    onResolved?.();
    return true;
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      intent="confirm"
      icon={ShieldQuestion}
      title={title || "Wielo support requested access"}
      description={
        body ||
        "Wielo support has asked to make changes to your account, including your financial records. Only approve this if you were expecting it."
      }
      actions={[
        { label: "Accept", kind: "primary", onClick: () => run("approve") },
        { label: "Decline", kind: "ghost", onClick: () => run("decline") },
        { label: "Report", kind: "danger", onClick: () => run("report") },
      ]}
    />
  );
}
