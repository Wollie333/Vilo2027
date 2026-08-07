"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptPlatformTermsAction } from "@/app/[locale]/portal/affiliates/actions";
import { Button } from "@/components/ui/button";

/**
 * Read-and-accept the platform terms directly from the affiliate activation
 * checklist, for a partner whose `terms_accepted_at` was never stamped (e.g. they
 * only ever booked). Clears the gate in place instead of dead-ending them.
 */
export function AcceptPlatformTermsButton() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();

  function accept() {
    if (!agreed) return;
    start(async () => {
      const res = await acceptPlatformTermsAction();
      if (res.ok) {
        toast.success("Thanks — platform terms accepted.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="w-full">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-brand-ink">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
        />
        <span>
          I have read and accept the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-primary underline"
          >
            platform terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-primary underline"
          >
            privacy policy
          </a>
          .
        </span>
      </label>
      <div className="mt-3 flex justify-end">
        <Button
          onClick={accept}
          disabled={!agreed || pending}
          className="gap-1.5"
        >
          <Check className="h-4 w-4" />
          {pending ? "Saving…" : "Accept & continue"}
        </Button>
      </div>
    </div>
  );
}
