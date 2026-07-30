import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** Rank string, e.g. "#3". */
  rank?: string;
  /** Live-listings score, e.g. "14". */
  score?: string;
  /** Gap to the leader, e.g. "6 listings". */
  gap?: string;
  /** Time left, e.g. "17 weeks". */
  weeksLeft?: string;
  /** Admin-editable intro paragraph (Communications override). */
  intro?: string;
};

export default function CampaignStandingsDigest({
  firstName,
  campaignName = "the Founding Race",
  rank,
  score,
  gap,
  weeksLeft,
  intro,
}: Props) {
  const greeting = firstName ? `Morning ${firstName},` : "Morning,";

  return (
    <Layout preview={`You're ${rank ?? "on the board"} in ${campaignName}`}>
      <Heading>Your weekly standings 📊</Heading>
      <Text>{greeting}</Text>
      <Text>
        {intro ??
          `Here's where you stand this week. You're ${rank ?? "on the board"}${score ? ` with ${score} live listings` : ""}${gap ? `, ${gap} behind the leader` : ""}.`}
      </Text>
      {weeksLeft ? (
        <Text>
          <strong>{weeksLeft}</strong> left to climb. A few more activated
          listings could move you up the board.
        </Text>
      ) : null}
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        See the full leaderboard
      </Button>
    </Layout>
  );
}
