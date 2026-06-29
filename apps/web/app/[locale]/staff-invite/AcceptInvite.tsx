"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptStaffInvite } from "@/app/[locale]/admin/platform/staff/actions";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-[13px] font-medium text-status-cancelled">{error}</p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await acceptStaffInvite(token);
            if (res.ok) {
              router.push("/admin");
            } else {
              setError(res.error);
            }
          });
        }}
        className="inline-flex w-full items-center justify-center rounded-[10px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
      >
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
    </div>
  );
}
