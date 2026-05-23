"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { signOutAction } from "../(auth)/actions";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
