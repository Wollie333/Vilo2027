import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  hostFirstName?: string;
  planName?: string;
  /** Human date the trial ends, e.g. "12 June 2026". */
  trialEndsLabel?: string;
  /**
   * Subscribe CTA. When the host was referred by an active affiliate this is
   * their /r/<slug> link (credits the referrer + drops the cookie) before
   * landing on the subscribe page; otherwise the plain subscribe link. Built
   * by the email resolver — see trialEndingResolver.
   */
  ctaUrl?: string;
};

export default function TrialEndingSoon({
  hostFirstName = "there",
  planName = "Pro",
  trialEndsLabel = "tomorrow",
  ctaUrl = `${APP_URL}/dashboard/settings/subscription`,
}: Props) {
  return (
    <Layout
      preview={`Your Wielo free trial ends ${trialEndsLabel} — subscribe to keep your listings live.`}
    >
      <Heading>Your trial ends in 24 hours</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        Your Wielo <strong>{planName}</strong> free trial ends{" "}
        <strong>{trialEndsLabel}</strong>. After that your account moves to
        read-only — your listings stop taking direct bookings until you
        subscribe.
      </Text>
      <Text>
        Subscribe now to keep your calendar, bookings, and guest messaging
        running without a break. <strong>No commission, ever</strong> — just
        your plan.
      </Text>

      <Button href={ctaUrl}>Subscribe &amp; keep my account active</Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Questions before you commit? Just reply to this email and we&apos;ll
        help.
      </Text>
    </Layout>
  );
}
