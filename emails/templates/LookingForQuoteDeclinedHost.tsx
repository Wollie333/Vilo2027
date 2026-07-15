import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import DetailTable from "../components/DetailTable";
import MessageBlock from "../components/MessageBlock";
import Shell from "../components/Shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wielo.co.za";

type Props = {
  hostFirstName?: string;
  guestName?: string;
  postTitle?: string;
  listingName?: string;
  quoteNumber?: string;
  declineReason?: string;
  declineNote?: string;
};

// Host email: the guest declined the host's Looking-For quote — with the reason
// they gave (and any note), so the host can learn from it.
export default function LookingForQuoteDeclinedHost({
  hostFirstName = "there",
  guestName = "The guest",
  postTitle = "their request",
  listingName = "your listing",
  quoteNumber = "Q-XXXX",
  declineReason = "",
  declineNote = "",
}: Props) {
  return (
    <Shell
      preview={`${guestName} declined your quote for "${postTitle}".`}
      eyebrow="Looking For"
      title={`Update on your quote, ${hostFirstName}`}
      subtitle={`${guestName} has declined your quote for "${postTitle}".`}
      pill={{ label: "DECLINED" }}
    >
      <Text style={{ margin: "0 0 20px", fontSize: 14, color: "#4A7C6A" }}>
        It happens — guests often collect a few quotes before deciding.
        Here&apos;s what they told us, so you can fine-tune your next quote.
      </Text>

      <DetailTable
        rows={[
          { label: "Quote", value: quoteNumber },
          { label: "Guest", value: guestName },
          { label: "Listing", value: listingName },
          { label: "Reason", value: declineReason || "Not specified" },
        ]}
      />

      {declineNote ? (
        <MessageBlock label={`What ${guestName} said`}>
          {declineNote}
        </MessageBlock>
      ) : null}

      <Button href={`${APP_URL}/dashboard/looking-for`}>
        Browse new requests →
      </Button>
    </Shell>
  );
}
