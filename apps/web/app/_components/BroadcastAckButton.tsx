"use client";

import { Check, X } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { ackBroadcastAction } from "./broadcast-ack-action";

export function BroadcastAckButton({
  id,
  mode,
}: {
  id: string;
  mode: "acknowledge" | "dismiss";
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={mode === "acknowledge" ? "default" : "ghost"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await ackBroadcastAction({ broadcastId: id, mode });
        })
      }
      className={
        mode === "acknowledge"
          ? "shrink-0 bg-red-900 text-white hover:bg-red-800"
          : "shrink-0"
      }
    >
      {mode === "acknowledge" ? (
        <>
          <Check className="mr-1 h-3.5 w-3.5" />
          {pending ? "…" : "Acknowledge"}
        </>
      ) : (
        <X className="h-4 w-4" />
      )}
    </Button>
  );
}
