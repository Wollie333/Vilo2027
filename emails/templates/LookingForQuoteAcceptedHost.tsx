import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import DetailTable from "../components/DetailTable";
import Shell from "../components/Shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wielo.co.za";

type Props = {
  hostFirstName?: string;
  guestName?: string;
  postTitle?: string;
  listingName?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: string;
  quoteNumber?: string;
  quoteId?: string;
};

// Host email: the guest accepted the host's Looking-For quote (a booking was
// created, awaiting payment).
export default function LookingForQuoteAcceptedHost({
  hostFirstName = "there",
  guestName = "The guest",
  postTitle = "their request",
  listingName = "your listing",
  checkIn = "—",
  checkOut = "—",
  totalAmount = "—",
  quoteNumber = "Q-XXXX",
  quoteId = "",
}: Props) {
  const url = quoteId
    ? `${APP_URL}/dashboard/quotes/${quoteId}`
    : `${APP_URL}/dashboard/looking-for/my-quotes`;
  return (
    <Shell
      preview={`${guestName} accepted your quote — booking created, awaiting payment.`}
      eyebrow="Looking For"
      title={`Your quote was accepted, ${hostFirstName}`}
      subtitle={`${guestName} accepted your quote for "${postTitle}". A booking has been created and is awaiting payment.`}
      pill={{ label: "ACCEPTED", emoji: "🎉" }}
    >
      <Text style={{ margin: "0 0 20px", fontSize: 14, color: "#4A7C6A" }}>
        Great news — here&apos;s what was agreed. The booking sits in your board
        as <strong>pending payment</strong>; the guest gets a pay link
        automatically.
      </Text>

      <DetailTable
        label="Accepted quote"
        rows={[
          { label: "Quote", value: quoteNumber },
          { label: "Guest", value: guestName },
          { label: "Listing", value: listingName },
          { label: "Check in", value: checkIn },
          { label: "Check out", value: checkOut },
          { label: "Total", value: totalAmount },
        ]}
      />

      <Button href={url}>View the booking →</Button>
    </Shell>
  );
}
