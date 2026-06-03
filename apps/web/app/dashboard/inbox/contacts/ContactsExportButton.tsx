"use client";

import { Download, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { exportContactsAction } from "../actions";

export function ContactsExportButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();

  function download() {
    if (pending) return;
    start(async () => {
      const result = await exportContactsAction();
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Nothing to export." : result.error);
        return;
      }
      const blob = new Blob([result.data.csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled || pending}
      className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </button>
  );
}
