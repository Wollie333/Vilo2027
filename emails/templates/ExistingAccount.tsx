import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Shell from "../components/Shell";

type Props = {
  signInUrl?: string;
  resetUrl?: string;
  brandName?: string;
};

// Anti-enumeration heads-up: someone tried to sign up with an email that already
// has an account. Migrated to the shared Shell design.
export default function ExistingAccount({
  signInUrl = "https://wielo.co.za/login",
  resetUrl = "https://wielo.co.za/forgot-password",
  brandName = "Wielo",
}: Props) {
  return (
    <Shell
      preview={`You already have a ${brandName} account`}
      eyebrow="Account"
      title="You already have an account"
      subtitle="There's nothing new to set up — just sign in."
      pill={{ label: "SIGN IN", emoji: "👋" }}
    >
      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        Someone (hopefully you) just tried to sign up for {brandName} with this
        email address — but you already have an account. There&rsquo;s nothing
        new to set up; just sign in.
      </Text>

      <Button href={signInUrl}>Sign in →</Button>

      <Text style={{ margin: "20px 0 0", fontSize: 13, color: "#4A7C6A" }}>
        Forgot your password?{" "}
        <a href={resetUrl} style={{ color: "#10B981" }}>
          Reset it here
        </a>
        . If this wasn&rsquo;t you, you can safely ignore this email — no one
        can access your account without your password.
      </Text>
    </Shell>
  );
}
