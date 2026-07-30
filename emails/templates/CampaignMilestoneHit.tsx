import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** Human milestone label, e.g. "First to 10 live listings". */
  milestoneLabel?: string;
  /** Formatted cash prize, e.g. "R 2 000". */
  prizeAmount?: string;
  /** Admin-editable intro paragraph (Communications override). */
  intro?: string;
};

export default function CampaignMilestoneHit({
  firstName,
  campaignName = "the Founding Race",
  milestoneLabel = "a milestone",
  prizeAmount,
  intro,
}: Props) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return (
    <Layout preview={`Milestone unlocked: ${milestoneLabel} 🏆`}>
      <Heading>Milestone unlocked 🏆</Heading>
      <Text>{greeting}</Text>
      <Text>
        {intro ??
          `You just hit ${milestoneLabel} in ${campaignName}${prizeAmount ? ` — that's a ${prizeAmount} prize` : ""}. Outstanding work.`}
      </Text>
      <Text>
        Cash prizes are settled by our team — we&apos;ll be in touch about
        payment. Now keep pushing for the top of the leaderboard.
      </Text>
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        View the leaderboard
      </Button>
    </Layout>
  );
}
