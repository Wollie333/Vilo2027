"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { resolveErrorAction } from "./actions";

export function ResolveButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resolveErrorAction(id);
          if (res.ok) {
            toast.success("Marked resolved — it'll reappear if it recurs.");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      {pending ? "…" : "Resolve"}
    </Button>
  );
}
