"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadEftProofAction } from "../actions";

/**
 * Lets the guest attach proof of their EFT transfer to the booking. The EFT
 * instructions email's "Upload proof of payment" button lands on this page.
 */
export function EftProofUploader({
  bookingId,
  alreadyUploaded,
}: {
  bookingId: string;
  alreadyUploaded: boolean;
}) {
  const [done, setDone] = useState(alreadyUploaded);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      const res = await uploadEftProofAction(bookingId, fd);
      if (res.ok) {
        setDone(true);
        setFileName(res.fileName);
        toast.success("Proof sent — your host has been notified.");
      } else {
        toast.error(res.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="mt-3 rounded-[8px] border border-dashed border-brand-line bg-white/70 p-3">
      <div className="flex items-start gap-2">
        {done ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        ) : (
          <Upload className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-brand-ink">
            {done ? "Proof of payment received" : "Already paid?"}
          </div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-brand-mute">
            {done
              ? `We've let your host know${fileName ? ` — ${fileName}` : ""}. They'll confirm once they've matched your transfer. You can upload again if you need to.`
              : "Upload your proof of payment and we'll notify your host to confirm it. JPG, PNG or PDF, up to 10MB."}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={onPick}
            disabled={isPending}
            className="sr-only"
            id={`eft-proof-${bookingId}`}
          />
          <label
            htmlFor={`eft-proof-${bookingId}`}
            aria-disabled={isPending}
            className={`mt-2.5 inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-[13px] font-semibold transition ${
              done
                ? "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                : "bg-brand-primary text-white hover:bg-brand-secondary"
            } ${isPending ? "pointer-events-none opacity-60" : ""}`}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {done ? "Upload another" : "Upload proof of payment"}
              </>
            )}
          </label>
        </div>
      </div>
    </div>
  );
}
