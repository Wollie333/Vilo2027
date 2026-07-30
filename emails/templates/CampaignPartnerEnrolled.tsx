import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** Admin-editable intro paragraph (Communications override). */
  intro?: string;
};

export default function CampaignPartnerEnrolled({
  firstName,
  campaignName = "the Founding Race",
  intro,
}: Props) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return (
    <Layout preview={`You're in ${campaignName} 🎉`}>
      <Heading>You&apos;re in {campaignName} 🎉</Heading>
      <Text>{greeting}</Text>
      <Text>
        {intro ??
          `You're officially enrolled in ${campaignName}. Every host you refer through your competition link earns you a 60% lifetime commission — locked in for as long as they stay with Wielo.`}
      </Text>
      <Text>
        Share your link, watch the leaderboard, and compete for the cash prizes.
        We&apos;ll keep you posted on where you stand.
      </Text>
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        Go to the competition
      </Button>
    </Layout>
  );
}
