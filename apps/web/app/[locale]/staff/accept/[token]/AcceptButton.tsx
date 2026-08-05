"use client";

import { UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import { acceptInviteAction } from "../../../dashboard/staff/actions";

export function AcceptButton({
  token,
  inviteEmail,
  matches,
}: {
  token: string;
  inviteEmail: string;
  matches: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [switching, setSwitching] = useState(false);
  const autoRan = useRef(false);

  function accept() {
    start(async () => {
      const r = await acceptInviteAction(token);
      if (r.ok) {
        toast.success("You're on the team!");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Already signed in as the invited email → join automatically, no click.
  useEffect(() => {
    if (matches && !autoRan.current) {
      autoRan.current = true;
      accept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // Wrong account → sign out, then sign in (or register) as the invited email.
  // On return the invite auto-accepts.
  async function switchAccount() {
    setSwitching(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Redirect regardless — the login page re-checks the session anyway.
    }
    const next = `/staff/accept/${encodeURIComponent(token)}`;
    window.location.href = `/login?email=${encodeURIComponent(
      inviteEmail,
    )}&next=${encodeURIComponent(next)}`;
  }

  if (matches) {
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

  return (
    <Button
      type="button"
      onClick={switchAccount}
      disabled={switching}
      className="w-full gap-1.5"
    >
      <UserCheck className="h-4 w-4" />
      {switching ? "Switching…" : `Continue as ${inviteEmail}`}
    </Button>
  );
}
