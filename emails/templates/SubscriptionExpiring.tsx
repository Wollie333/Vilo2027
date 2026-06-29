import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  hostFirstName?: string;
  planName?: string;
  renewalDate?: string;
  price?: string;
};

export default function SubscriptionExpiring({
  hostFirstName = "there",
  planName = "Pro",
  renewalDate = "—",
  price = "—",
}: Props) {
  return (
    <Layout
      preview={`Your Wielo ${planName} subscription renews on ${renewalDate}.`}
    >
      <Heading>Heads up — your renewal is coming</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        Your Wielo <strong>{planName}</strong> subscription will renew on{" "}
        <strong>{renewalDate}</strong> for <strong>{price}</strong>.
      </Text>
      <Text>
        No action needed — we'll charge your saved payment method. Want to
        change plan or billing cycle?
      </Text>

      <Button href={`${APP_URL}/dashboard/settings/subscription`}>
        Manage subscription
      </Button>
    </Layout>
  );
}
