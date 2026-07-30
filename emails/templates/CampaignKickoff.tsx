import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** Human end date, e.g. "30 November 2026". */
  endsOn?: string;
  /** Admin-editable intro paragraph (Communications override). */
  intro?: string;
};

export default function CampaignKickoff({
  firstName,
  campaignName = "the Founding Race",
  endsOn,
  intro,
}: Props) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return (
    <Layout preview={`${campaignName} is officially on`}>
      <Heading>{campaignName} is on 🏁</Heading>
      <Text>{greeting}</Text>
      <Text>
        {intro ??
          `The starting gun has fired — ${campaignName} is now live${endsOn ? ` and runs until ${endsOn}` : ""}. Every host you refer earns you a 60% lifetime commission, and the leaderboard is live from today.`}
      </Text>
      <Text>
        Grab your referral link, start sharing, and get on the board early — the
        cash prizes are waiting.
      </Text>
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        Open the competition
      </Button>
    </Layout>
  );
}
