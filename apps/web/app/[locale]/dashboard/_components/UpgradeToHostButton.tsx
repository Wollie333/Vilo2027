"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { upgradeToFullHostAction } from "./upgradeActions";

const UNLOCKS = [
  "List properties & take direct bookings",
  "Calendar, availability & iCal sync",
  "Payments, invoices & your own booking website",
];

// Self-serve "upgrade to a full host account" for a quotes-only account. Opens a
// confirmation, flips the account class server-side, then reloads into the full
// host dashboard. Quotes + credits are preserved.
export function UpgradeToHostButton({
  className,
  label = "Upgrade to a full host account",
  variant = "default",
}: {
  className?: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const r = await upgradeToFullHostAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("You're now a full host account.");
      setOpen(false);
      // Re-render the shell (layout re-resolves scope → full host) and land home.
      router.refresh();
      router.push("/dashboard");
    });
  }

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        <ArrowUpRight className="mr-1.5 h-4 w-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to a full host account</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-brand-mute">
            You&apos;ll unlock the whole host dashboard. Your Looking-For quotes
            and Wielo Credits stay exactly as they are.
          </p>
          <ul className="mt-1 space-y-2">
            {UNLOCKS.map((u) => (
              <li
                key={u}
                className="flex items-start gap-2 text-[13px] text-brand-ink"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                {u}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-brand-mute">
            It&apos;s free to switch — you only pay when you subscribe to a host
            plan for the paid host features.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Not now
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending ? "Upgrading…" : "Upgrade my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
