import type { Metadata } from "next";

import { AuthShell } from "../_components/AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { SentNotice } from "./SentNotice";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Send yourself a password reset link.",
};

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: { sent?: string };
}) {
  return (
    <AuthShell>
      {searchParams?.sent === "1" ? <SentNotice /> : <ForgotPasswordForm />}
    </AuthShell>
  );
}
