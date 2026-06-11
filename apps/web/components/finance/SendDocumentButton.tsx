"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { sendDocumentLinkAction } from "@/app/[locale]/dashboard/documents-actions";

// Send a document's public link to the guest's inbox thread. Builds the absolute
// URL from the current origin + the public token path, so the guest can open and
// download it. Used in the FinancialDocument action bar (host view only).
export function SendDocumentButton({
  bookingId,
  path,
  label,
}: {
  bookingId: string;
  path: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${path}`
          : path;
      const r = await sendDocumentLinkAction({ bookingId, url, label });
      if (r.ok) {
        toast.success("Sent to the guest's inbox.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={pending}
      className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
    >
      <Send className="h-4 w-4 text-brand-mute" />{" "}
      {pending ? "Sending…" : "Send"}
    </button>
  );
}
