import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Shell from "../components/Shell";

type Props = {
  firstName?: string;
  confirmUrl?: string;
  brandName?: string;
};

// Soft email-verification message (see lib/auth/verifyEmail.ts). Migrated to the
// shared Shell so it matches every other Wielo email.
export default function ConfirmEmail({
  firstName = "there",
  confirmUrl = "https://wielo.co.za",
  brandName = "Wielo",
}: Props) {
  return (
    <Shell
      preview={`Confirm your email to secure your ${brandName} account`}
      eyebrow="Welcome"
      title="Confirm your email"
      subtitle="One quick tap keeps your account and bookings secure."
      pill={{ label: "CONFIRM EMAIL", emoji: "✅" }}
    >
      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        Hi {firstName}, welcome to {brandName}. Please confirm this is your
        email address so we can keep your account and bookings secure.
      </Text>

      <Button href={confirmUrl}>Confirm my email →</Button>

      <Text style={{ margin: "20px 0 0", fontSize: 13, color: "#4A7C6A" }}>
        This link expires in 3 days. Didn&rsquo;t create a {brandName} account?
        You can safely ignore this email.
      </Text>
    </Shell>
  );
}
