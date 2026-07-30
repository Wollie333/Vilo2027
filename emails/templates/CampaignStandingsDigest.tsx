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
        {intro ?? `Here's where you stand in ${campaignName} this week.`}
      </Text>
      <DetailTable
        label="Your standings"
        rows={[
          { label: "Your rank", value: rank ?? "On the board" },
          {
            label: "Live listings",
            value: score != null ? score : null,
          },
          { label: "Behind the leader", value: gap ?? null },
          { label: "Time left", value: weeksLeft ?? null },
        ]}
      />
      {weeksLeft ? (
        <Text>
          A few more activated listings could move you up the board before the
          race closes.
        </Text>
      ) : null}
      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        See the full leaderboard
      </Button>
    </Layout>
  );
}
