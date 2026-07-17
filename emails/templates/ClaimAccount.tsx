import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Shell from "../components/Shell";

type Props = {
  firstName?: string;
  claimUrl?: string;
  brandName?: string;
};

// Someone tried to sign up with an email that already has a PASSWORDLESS account
// (is_lead) — minted when they were added as a party guest on a booking, or sent
// an enquiry. BUSINESS_PRINCIPLES #1 rule 3: recognise them and prompt them to
// set a password, never dead-end them with "email already registered".
// The sibling ExistingAccount template is for accounts that DO have a password;
// telling a lead to "just sign in" would strand them.
export default function ClaimAccount({
  firstName = "there",
  claimUrl = "https://wielo.co.za/login",
  brandName = "Wielo",
}: Props) {
  return (
    <Shell
      preview={`Set your password to finish your ${brandName} account`}
      eyebrow="Account"
      title="You already have an account here"
      subtitle="Set a password and it's yours."
      pill={{ label: "SET PASSWORD", emoji: "🔑" }}
    >
      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        Hi {firstName}, we already created a {brandName} account for this email
        — someone added you to a booking, or you sent a host a request. It has
        no password yet, so nothing has been set up for you to remember.
      </Text>

      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        Set a password and the account is yours — with every trip, message and
        booking already on it, across every host you&rsquo;ve stayed with.
      </Text>

      <Button href={claimUrl}>Set your password →</Button>

      <Text style={{ margin: "20px 0 0", fontSize: 13, color: "#4A7C6A" }}>
        This link signs you in and expires shortly. If this wasn&rsquo;t you,
        you can safely ignore this email — the account stays passwordless and no
        one can access it.
      </Text>
    </Shell>
  );
}
