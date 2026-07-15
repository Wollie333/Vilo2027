"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setHostAccess } from "./actions";

// Admin controls for the quote-only account class + the two block switches.
// Compact card on the user record — flips account_kind and the quote_access /
// platform_access switches (audited via setHostAccessAction).
export function HostAccessControls({
  userId,
  accountKind,
  quoteAccess,
  platformAccess,
}: {
  userId: string;
  accountKind: string;
  quoteAccess: boolean;
  platformAccess: boolean;
}) {
  const [pending, start] = useTransition();

  function apply(
    patch: Partial<{
      accountKind: "host" | "quote_only";
      quoteAccess: boolean;
      platformAccess: boolean;
    }>,
    okMsg: string,
  ) {
    start(async () => {
      const r = await setHostAccess({ userId, ...patch });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(okMsg);
    });
  }

  const isQuoteOnly = accountKind === "quote_only";

  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[13px] font-bold text-brand-ink">
        Account type & access
      </div>
      <p className="mt-1 text-[12px] text-brand-mute">
        A quote-only account only sees the quote surfaces. The switches block
        quote sending or the whole platform.
      </p>

      <div className="mt-3 space-y-2.5">
        <Row
          label="Account type"
          value={isQuoteOnly ? "Quote-only" : "Full host"}
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                apply(
                  { accountKind: isQuoteOnly ? "host" : "quote_only" },
                  isQuoteOnly ? "Set to full host." : "Set to quote-only.",
                )
              }
            >
              {isQuoteOnly ? "Make full host" : "Make quote-only"}
            </Button>
          }
        />
        <Row
          label="Quote sending"
          value={quoteAccess ? "Allowed" : "Blocked"}
          action={
            <Button
              size="sm"
              variant={quoteAccess ? "outline" : "default"}
              disabled={pending}
              onClick={() =>
                apply(
                  { quoteAccess: !quoteAccess },
                  quoteAccess
                    ? "Quote sending blocked."
                    : "Quote sending restored.",
                )
              }
            >
              {quoteAccess ? "Block" : "Unblock"}
            </Button>
          }
        />
        <Row
          label="Platform access"
          value={platformAccess ? "Full" : "Quotes-only shell"}
          action={
            <Button
              size="sm"
              variant={platformAccess ? "outline" : "default"}
              disabled={pending}
              onClick={() =>
                apply(
                  { platformAccess: !platformAccess },
                  platformAccess
                    ? "Bounced to the quotes-only shell."
                    : "Full platform access restored.",
                )
              }
            >
              {platformAccess ? "Restrict" : "Restore"}
            </Button>
          }
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-brand-ink">{label}</div>
        <div className="text-[11.5px] text-brand-mute">{value}</div>
      </div>
      {action}
    </div>
  );
}
