import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  hostFirstName?: string;
  planName?: string;
  amount?: string;
  gracePeriodEndsAt?: string;
};

export default function SubscriptionFailed({
  hostFirstName = "there",
  planName = "Pro",
  amount = "—",
  gracePeriodEndsAt = "—",
}: Props) {
  return (
    <Layout
      preview={`We couldn't process your Wielo ${planName} payment of ${amount}.`}
    >
      <Heading>Your payment didn't go through</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        We had trouble processing your Wielo <strong>{planName}</strong> payment
        of <strong>{amount}</strong>.
      </Text>
      <Text>
        No panic — your account stays fully active until{" "}
        <strong>{gracePeriodEndsAt}</strong>. Update your payment method and
        everything will keep running smoothly.
      </Text>

      <Button href={`${APP_URL}/dashboard/settings/subscription`}>
        Update payment method
      </Button>
    </Layout>
  );
}
