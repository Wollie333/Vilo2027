import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  guestFirstName?: string;
  listingName?: string;
  hostMessage?: string | null;
  checkIn?: string;
  checkOut?: string;
};

export default function BookingDeclinedGuest({
  guestFirstName = "there",
  listingName = "the listing",
  hostMessage = null,
  checkIn = "—",
  checkOut = "—",
}: Props) {
  return (
    <Layout preview={`Your booking request at ${listingName} wasn't accepted.`}>
      <Heading>Your booking request wasn&apos;t accepted</Heading>
      <Text>Hi {guestFirstName},</Text>
      <Text>
        The host of <strong>{listingName}</strong> couldn&apos;t take your
        booking for {checkIn} → {checkOut}. No payment was taken.
      </Text>

      {hostMessage ? (
        <div
          style={{
            background: "#FAFDF9",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 16,
            margin: "16px 0",
            fontStyle: "italic",
            color: "#374151",
          }}
        >
          “{hostMessage}”
        </div>
      ) : null}

      <Text>Other places might fit your dates — explore the directory:</Text>

      <Button href={`${APP_URL}/explore`}>Browse Wielo</Button>
    </Layout>
  );
}
