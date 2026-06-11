"use client";

import { Ban } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { cancelBroadcastSafe } from "../actions";

export function CancelButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function onConfirm() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    start(async () => {
      const result = await cancelBroadcastSafe({ id, reason: reason.trim() });
      if (result.ok) {
        toast.success("Broadcast cancelled");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <Ban className="mr-1.5 h-4 w-4" />
        Cancel broadcast now
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-brand-line bg-white p-4">
      <Label htmlFor="cancel_reason" className="text-xs text-brand-mute">
        Why are you cancelling?
      </Label>
      <Input
        id="cancel_reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Audit-log reason (min 5 chars)"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Keep active
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Cancelling…" : "Confirm cancel"}
        </Button>
      </div>
    </div>
  );
}
