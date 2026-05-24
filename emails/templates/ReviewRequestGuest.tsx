import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://viloplatform.com";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  hostName?: string;
  bookingId?: string;
  reviewToken?: string;
};

export default function ReviewRequestGuest({
  guestFirstName = "there",
  listingName = "your stay",
  hostName = "your host",
  bookingId = "",
  reviewToken = "",
}: Props) {
  const link = `${APP_URL}/review/${bookingId}?token=${reviewToken}`;
  return (
    <Layout
      preview={`How was your stay at ${listingName}? Tell future guests.`}
    >
      <Heading>How was it, {guestFirstName}?</Heading>
      <Text>
        Hope your stay at <strong>{listingName}</strong> went well. Future
        guests really value an honest review — it takes about 30 seconds.
      </Text>

      <Button href={link}>Leave a review</Button>

      <Text style={{ marginTop: 20, fontSize: 13, color: "#6B7280" }}>
        Reviews go live after a 48-hour moderation window. {hostName} will be
        able to reply once your review is published.
      </Text>
    </Layout>
  );
}
