"use client";

import { useState, useTransition } from "react";

import { resendVerificationEmailAction } from "@/app/[locale]/portal/affiliates/actions";
import { Button } from "@/components/ui/button";

// Re-send the confirmation email from the pending-partner checklist. Settles
// into a "Sent" state rather than resetting, so a frustrated partner doesn't
// hammer it (the action is rate limited regardless).
export function ResendVerificationButton() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <span className="text-[13px] font-semibold text-[#047857]">
        Sent — check your inbox
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await resendVerificationEmailAction();
            if (res.ok) {
              setState("sent");
            } else {
              setState("error");
              setMessage(res.error);
            }
          })
        }
      >
        {pending ? "Sending…" : "Send again"}
      </Button>
      {state === "error" && message ? (
        <span className="text-status-error text-[12.5px]">{message}</span>
      ) : null}
    </div>
  );
}
