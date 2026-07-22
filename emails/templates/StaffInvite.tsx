import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  inviteeFirstName?: string | null;
  hostName?: string;
  propertyName?: string;
  inviteToken?: string;
  expiresAt?: string;
};

export default function StaffInvite({
  inviteeFirstName = null,
  hostName = "Your host",
  propertyName = "their property",
  inviteToken = "",
  expiresAt = "7 days",
}: Props) {
  const greeting = inviteeFirstName ? `Hi ${inviteeFirstName},` : "Hi there,";
  return (
    <Layout
      preview={`${hostName} invited you to help manage ${propertyName} on Wielo.`}
    >
      <Heading>You've been invited to Wielo</Heading>
      <Text>{greeting}</Text>
      <Text>
        <strong>{hostName}</strong> has invited you to join the team at{" "}
        <strong>{propertyName}</strong> on Wielo. You'll be able to manage
        bookings, handle guest messages, and keep the calendar up to date.
      </Text>

      <Button href={`${APP_URL}/staff/accept/${inviteToken}`}>
        Accept invitation
      </Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        This invitation expires in {expiresAt}. If you weren't expecting it, you
        can safely ignore this email.
      </Text>
    </Layout>
  );
}
