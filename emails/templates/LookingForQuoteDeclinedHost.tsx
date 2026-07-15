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
  quoteNumber?: string;
};

// Host email: the guest declined the host's Looking-For quote.
export default function LookingForQuoteDeclinedHost({
  hostFirstName = "there",
  guestName = "The guest",
  postTitle = "their request",
  listingName = "your listing",
  quoteNumber = "Q-XXXX",
}: Props) {
  return (
    <Shell
      preview={`${guestName} declined your quote for "${postTitle}".`}
      eyebrow="Looking For"
      title={`Update on your quote, ${hostFirstName}`}
      subtitle={`${guestName} has declined your quote for "${postTitle}". No further action is needed.`}
      pill={{ label: "DECLINED" }}
    >
      <Text style={{ margin: "0 0 20px", fontSize: 14, color: "#4A7C6A" }}>
        It happens — guests often collect a few quotes before deciding. You can
        keep an eye on new requests in your area and quote again anytime.
      </Text>

      <DetailTable
        rows={[
          { label: "Quote", value: quoteNumber },
          { label: "Guest", value: guestName },
          { label: "Listing", value: listingName },
        ]}
      />

      <Button href={`${APP_URL}/dashboard/looking-for`}>
        Browse new requests →
      </Button>
    </Shell>
  );
}
