"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { respondSupportAccessAction } from "./actions";

export function GrantActions({
  grantId,
  variant,
}: {
  grantId: string;
  variant: "pending" | "active";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function act(action: "approve" | "decline" | "revoke") {
    start(async () => {
      const r = await respondSupportAccessAction({ grantId, action });
      if (r.ok) {
        toast.success(
          action === "approve"
            ? "Access approved."
            : action === "decline"
              ? "Request declined."
              : "Access revoked.",
        );
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (variant === "active") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        className="border-red-200 text-red-600 hover:bg-red-50"
        onClick={() => act("revoke")}
      >
        Revoke access
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => act("approve")}>
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => act("decline")}
      >
        Decline
      </Button>
    </div>
  );
}
