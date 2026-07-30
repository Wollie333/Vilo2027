import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** The referred host's display name. */
  hostName?: string;
  /** The listing that just went live. */
  listingName?: string;
  /** Admin-editable intro paragraph (Communications override). */
  intro?: string;
};

export default function CampaignReferralActivated({
  firstName,
  campaignName = "the Founding Race",
  hostName,
  listingName,
  intro,
}: Props) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const who = hostName ?? "A host you referred";

  return (
    <Layout preview={`${who} just went live — that's a point on the board`}>
      <Heading>A referral just went live 🚀</Heading>
      <Text>{greeting}</Text>
      <Text>
        {intro ??
          `${who} just published ${listingName ? `“${listingName}”` : "their first listing"} on Wielo — so that's another activated listing on your ${campaignName} scoreboard.`}
      </Text>
      <Text>
        The more of your referred hosts go live, the higher you climb. Keep the
        momentum going.
      </Text>
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        See your standings
      </Button>
    </Layout>
  );
}
