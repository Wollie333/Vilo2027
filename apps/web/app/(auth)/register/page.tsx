import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "../_components/AuthShell";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Accept your invite",
  description: "Set a password to finish joining your team on Vilo.",
};

// /register is intentionally not a public signup. It only stays alive as the
// landing page for the staff-invite acceptance flow at /staff/accept/<token>,
// which bounces logged-out invitees here with ?email=…&invite_token=…&next=….
// Direct visits (no token) are sent to /signup, our public onboarding gate.
export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { invite_token?: string; email?: string };
}) {
  const hasInvite =
    typeof searchParams?.invite_token === "string" &&
    searchParams.invite_token.length > 0 &&
    typeof searchParams?.email === "string" &&
    searchParams.email.length > 0;
  if (!hasInvite) {
    redirect("/signup");
  }
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
