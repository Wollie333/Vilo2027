"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setFoundingOffersOpen } from "./actions";

export function FoundingOffersToggle({ open }: { open: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(open);
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setOn(next); // optimistic
    start(async () => {
      const res = await setFoundingOffersOpen(next);
      if (!res.ok) {
        setOn(!next);
        toast.error(res.error);
        return;
      }
      toast.success(
        next ? "Founding offers are now OPEN." : "Founding offers closed.",
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-brand-ink">
              Founding offers {on ? "open" : "closed"}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-brand-mute">
              While open, any host who subscribes to the paid plan is charged
              the{" "}
              <span className="font-semibold text-brand-ink">
                Founding price
              </span>{" "}
              and gets a{" "}
              <span className="font-semibold text-brand-ink">
                lifetime price-lock
              </span>{" "}
              at conversion — their price never moves while they stay. Close
              this when beta ends and new subscribers pay the list price.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={pending}
          onClick={() => toggle(!on)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
            on ? "bg-brand-primary" : "bg-brand-line"
          } disabled:opacity-60`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              on ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
          {pending ? (
            <Loader2 className="absolute -right-6 h-4 w-4 animate-spin text-brand-mute" />
          ) : null}
        </button>
      </div>
    </div>
  );
}
