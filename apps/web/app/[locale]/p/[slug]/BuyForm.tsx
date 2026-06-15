"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";

import { buyProductAction } from "./actions";

export function BuyForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
      />
      <button
        type="button"
        disabled={pending || !email.trim()}
        onClick={() =>
          start(async () => {
            const r = await buyProductAction(slug, email);
            if (r.ok) window.location.href = r.url;
            else toast.error(r.error);
          })
        }
        className="inline-flex w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
      >
        {pending ? "Continuing…" : "Continue to payment"}
      </button>
    </div>
  );
}
