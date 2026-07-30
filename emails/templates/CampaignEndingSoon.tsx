import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import DetailTable from "../components/DetailTable";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** Time remaining, e.g. "2 weeks". */
  timeLeft?: string;
  /** Current rank, e.g. "#3". */
  rank?: string;
  /** Admin-editable intro paragraph (Communications override). */
  intro?: string;
};

export default function CampaignEndingSoon({
  firstName,
  campaignName = "the Founding Race",
  timeLeft = "not long",
  rank,
  intro,
}: Props) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return (
    <Layout preview={`${timeLeft} left in ${campaignName}`}>
      <Heading>Final stretch — {timeLeft} left ⏳</Heading>
      <Text>{greeting}</Text>
      <Text>
        {intro ??
          `${campaignName} wraps up soon. This is the moment for a final push — every listing your referred hosts bring live between now and the finish counts.`}
      </Text>
      <DetailTable
        rows={[
          { label: "Competition", value: campaignName },
          { label: "Time left", value: timeLeft },
          { label: "Your rank", value: rank ?? null },
        ]}
      />
      <Text>
        Prizes are decided on the final standings, so a strong close could
        change everything.
      </Text>
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        Make your final push
      </Button>
    </Layout>
  );
}
