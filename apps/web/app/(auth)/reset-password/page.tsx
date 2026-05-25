import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { AuthShell } from "../_components/AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password · Vilo",
  description: "Set a new password for your Vilo account.",
};

export default async function ResetPasswordPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The recovery email flow lands here only after /auth/confirm has issued a
  // session via verifyOtp. Direct visits without a session bounce back to the
  // request-link page.
  if (!user) {
    redirect("/forgot-password");
  }

  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
