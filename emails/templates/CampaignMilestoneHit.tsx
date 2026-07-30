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
          `You just hit ${milestoneLabel} in ${campaignName}. Outstanding work.`}
      </Text>
      <DetailTable
        rows={[
          { label: "Milestone", value: milestoneLabel },
          { label: "Competition", value: campaignName },
          { label: "Prize", value: prizeAmount ?? null },
        ]}
      />
      <Text>
        {prizeAmount
          ? "Cash prizes are settled by our team — we'll be in touch about payment. "
          : ""}
        Now keep pushing for the top of the leaderboard.
      </Text>
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        View the leaderboard
      </Button>
    </Layout>
  );
}
