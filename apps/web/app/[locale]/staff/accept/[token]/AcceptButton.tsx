"use client";

import { UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { acceptInviteAction } from "../../../dashboard/staff/actions";

export function AcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function accept() {
    start(async () => {
      const r = await acceptInviteAction(token);
      if (r.ok) {
        toast.success("You're on the team!");
        router.push("/dashboard");
      } else {
        toast.error(r.error);
        if (r.reason === "wrong_account") {
          router.push(`/login?next=/staff/accept/${token}`);
        }
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={accept}
      disabled={pending}
      className="w-full gap-1.5"
    >
      <UserCheck className="h-4 w-4" />
      {pending ? "Joining…" : "Accept invite"}
    </Button>
  );
}
