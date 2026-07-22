import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  campaignName?: string;
  /** "true" when paused. Refs cross the queue as strings. */
  paused?: string;
  reason?: string;
};

export default function CampaignPauseChanged({
  firstName,
  campaignName = "the competition",
  paused,
  reason,
}: Props) {
  const isPaused = paused === "true";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return (
    <Layout
      preview={
        isPaused
          ? `You've been paused in ${campaignName}`
          : `You're back in ${campaignName}`
      }
    >
      <Heading>
        {isPaused
          ? `You've been paused in ${campaignName}`
          : `You're back in ${campaignName} 🎉`}
      </Heading>

      <Text>{greeting}</Text>

      {isPaused ? (
        <>
          <Text>
            Your place in <strong>{campaignName}</strong> has been paused, so
            you won&apos;t appear on the leaderboard or be in the running for
            prizes for now.
          </Text>
          {reason ? (
            <Text>
              <strong>Reason:</strong> {reason}
            </Text>
          ) : null}
          <Text>
            <strong>
              This does not affect your commission or your referral links.
            </strong>{" "}
            Your links keep working, every host you have already referred still
            earns you your usual rate, and your commission ladder is untouched.
            Your score also keeps counting in the background — if you&apos;re
            resumed, you pick up exactly where you actually are, not where you
            were when you were paused.
          </Text>
          <Text>
            If you think this is a mistake, just reply to this email and
            we&apos;ll take a look.
          </Text>
        </>
      ) : (
        <>
          <Text>
            Good news — your place in <strong>{campaignName}</strong> has been
            restored. You&apos;re back on the leaderboard and back in the
            running for prizes.
          </Text>
          <Text>
            Your score kept counting while you were paused, so your standing
            reflects where you actually are today.
          </Text>
        </>
      )}

      <Button href={`${APP_URL}/portal/affiliates/competitions`}>
        View the competition
      </Button>
    </Layout>
  );
}
