import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Shell from "../components/Shell";

type Props = {
  firstName?: string;
  resetUrl?: string;
  brandName?: string;
};

// Password-reset email. Sent from our own auth flow (a self-built recovery link
// through /auth/confirm → /reset-password) so it carries the Wielo design and
// lands on the set-new-password page, never a bare dashboard redirect.
export default function PasswordReset({
  firstName = "there",
  resetUrl = "https://wielo.co.za/forgot-password",
  brandName = "Wielo",
}: Props) {
  return (
    <Shell
      preview={`Reset your ${brandName} password`}
      eyebrow="Account security"
      title="Reset your password"
      subtitle="Click below to choose a new password. The link expires soon."
      pill={{ label: "PASSWORD RESET", emoji: "🔒" }}
    >
      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        Hi {firstName}, we received a request to reset the password on your{" "}
        {brandName} account. Choose a new password using the button below.
      </Text>

      <Button href={resetUrl}>Choose a new password →</Button>

      <Text style={{ margin: "20px 0 0", fontSize: 13, color: "#4A7C6A" }}>
        For your security this link expires in 60 minutes and can be used once.
        If you didn&rsquo;t ask to reset your password, you can safely ignore
        this email — your password won&rsquo;t change.
      </Text>
    </Shell>
  );
}
