"use client";

import { CheckCircle2, FileText, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { generateInvoicePdfAction, markInvoicePaidAction } from "../actions";
import type { InvoiceStatus } from "../../quotes/schemas";

export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function markPaid(paid: boolean) {
    start(async () => {
      const r = await markInvoicePaidAction(invoiceId, paid);
      if (r.ok) {
        toast.success(paid ? "Marked paid" : "Marked unpaid");
        router.refresh();
      } else toast.error(r.error);
    });
  }
  function regeneratePdf() {
    start(async () => {
      const r = await generateInvoicePdfAction(invoiceId);
      if (r.ok) toast.success("PDF regenerated");
      else toast.error(r.error);
    });
  }

  const canMarkPaid = status === "issued";
  const canMarkUnpaid = status === "paid";

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-base font-bold text-brand-ink">
          Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {canMarkPaid ? (
            <Button
              type="button"
              onClick={() => markPaid(true)}
              disabled={pending}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Mark paid
            </Button>
          ) : null}
          {canMarkUnpaid ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => markPaid(false)}
              disabled={pending}
              className="gap-1.5"
            >
              <Undo2 className="h-4 w-4" /> Revert to issued
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={regeneratePdf}
            disabled={pending}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" /> Regenerate PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
