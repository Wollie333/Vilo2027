import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** One line summarising what they won, e.g. "1st place · R15 000 + a 20% rate floor". */
  detail?: string;
};

export default function CampaignWon({
  firstName,
  campaignName = "the competition",
  detail,
}: Props) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return (
    <Layout preview={`You won a prize in ${campaignName} 🏆`}>
      <Heading>Congratulations — you won! 🏆</Heading>

      <Text>{greeting}</Text>

      <Text>
        The final results for <strong>{campaignName}</strong> are in, and you
        finished as one of the winners.
      </Text>

      {detail ? (
        <Text>
          <strong>Your prize:</strong> {detail}
        </Text>
      ) : null}

      <Text>
        Any commission rate floor you won is already locked to your account and
        applies to your future earnings automatically. Cash prizes are settled
        by our team — we&apos;ll be in touch about payment.
      </Text>

      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        View the final leaderboard
      </Button>
    </Layout>
  );
}
