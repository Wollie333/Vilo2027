import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://viloplatform.com";

type Props = {
  hostFirstName?: string;
  planName?: string;
  isTrial?: boolean;
  trialEnds?: string | null;
  renewsAt?: string | null;
};

export default function SubscriptionWelcome({
  hostFirstName = "there",
  planName = "Pro",
  isTrial = true,
  trialEnds = null,
  renewsAt = null,
}: Props) {
  return (
    <Layout
      preview={`Welcome to Vilo ${planName} — everything you need to run direct bookings.`}
    >
      <Heading>Welcome to Vilo {planName}</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        {isTrial
          ? `You're on a 14-day trial of Vilo ${planName}.`
          : `You're now on Vilo ${planName}.`}{" "}
        Every {planName} feature is unlocked across your dashboard right now.
      </Text>

      {isTrial && trialEnds ? (
        <Text style={{ margin: "8px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Trial ends:</span>{" "}
          <strong>{trialEnds}</strong>
        </Text>
      ) : renewsAt ? (
        <Text style={{ margin: "8px 0", fontSize: 14 }}>
          <span style={{ color: "#6B7280" }}>Renews:</span>{" "}
          <strong>{renewsAt}</strong>
        </Text>
      ) : null}

      <Text>A few things worth doing now:</Text>
      <ul style={{ paddingLeft: 20, fontSize: 14 }}>
        <li>Enable instant booking on your top listings.</li>
        <li>Add staff seats so co-hosts can help.</li>
        <li>Set up message templates to reply faster.</li>
      </ul>

      <Button href={`${APP_URL}/dashboard`}>Open dashboard</Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Cancel any time from{" "}
        <a href={`${APP_URL}/dashboard/settings/subscription`}>
          subscription settings
        </a>{" "}
        — no contracts, no fine print.
      </Text>
    </Layout>
  );
}
