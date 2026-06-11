"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CreditNoteStatus } from "../../quotes/schemas";
import { cancelCreditNoteAction } from "../actions";

export function CreditNoteActions({
  creditNoteId,
  status,
}: {
  creditNoteId: string;
  status: CreditNoteStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function cancel() {
    start(async () => {
      const r = await cancelCreditNoteAction(creditNoteId);
      if (r.ok) {
        toast.success("Credit note cancelled");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-base font-bold text-brand-ink">
          Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {status !== "cancelled" ? (
            <Button
              type="button"
              variant="outline"
              onClick={cancel}
              disabled={pending}
              className="gap-1.5"
            >
              <Ban className="h-4 w-4" /> Cancel credit note
            </Button>
          ) : (
            <p className="text-sm text-brand-mute">
              This credit note has been cancelled.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
