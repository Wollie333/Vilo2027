import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://viloplatform.com";

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
      preview={`Your Vilo ${planName} subscription has lapsed — some features are on hold.`}
    >
      <Heading>Your account is on hold</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        Your Vilo <strong>{planName}</strong> subscription has lapsed, so some
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
