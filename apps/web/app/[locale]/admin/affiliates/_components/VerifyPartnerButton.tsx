"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setAffiliateVerifiedAction } from "../actions";

export function VerifyPartnerButton({
  affiliateId,
  verified,
}: {
  affiliateId: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const res = await setAffiliateVerifiedAction({
        affiliateId,
        verified: !verified,
      });
      if (res.ok) {
        toast.success(
          verified ? "Verified badge removed." : "Partner verified.",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={verified ? "btn-ghost h-9" : "btn-sec h-9"}
    >
      <BadgeCheck className="h-4 w-4" />
      {verified ? "Remove verification" : "Verify partner"}
    </button>
  );
}
