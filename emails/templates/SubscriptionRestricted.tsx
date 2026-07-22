import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  hostFirstName?: string;
  planName?: string;
};

export default function SubscriptionRestricted({
  hostFirstName = "there",
  planName = "Pro",
}: Props) {
  return (
    <Layout
      preview={`Your Wielo ${planName} subscription has lapsed — some features are on hold.`}
    >
      <Heading>Your account is on hold</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        Your Wielo <strong>{planName}</strong> subscription has lapsed, so some
        features are currently restricted:
      </Text>
      <ul style={{ paddingLeft: 20, fontSize: 14, color: "#0D2B21" }}>
        <li>
          Your listings stay in the directory, but guests can only send
          enquiries (no direct bookings).
        </li>
        <li>Your dashboard remains accessible.</li>
      </ul>
      <Text>Reactivate to restore full access right away.</Text>

      <Button href={`${APP_URL}/dashboard/settings/subscription`}>
        Reactivate subscription
      </Button>
    </Layout>
  );
}
