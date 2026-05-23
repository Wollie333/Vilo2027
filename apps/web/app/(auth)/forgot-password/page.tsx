import type { Metadata } from "next";

import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { SentNotice } from "./SentNotice";

export const metadata: Metadata = {
  title: "Reset your password · Vilo",
  description: "Send yourself a password reset link.",
};

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: { sent?: string };
}) {
  if (searchParams?.sent === "1") {
    return <SentNotice />;
  }
  return <ForgotPasswordForm />;
}
