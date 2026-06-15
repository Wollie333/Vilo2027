"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startProductPaystackAction } from "./actions";

export function PayButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await startProductPaystackAction(token);
          if (r.ok) window.location.href = r.url;
          else toast.error(r.error);
        })
      }
      className="inline-flex w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
    >
      {pending ? "Redirecting…" : "Pay with card"}
    </button>
  );
}
