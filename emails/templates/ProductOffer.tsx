import { Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Shell from "../components/Shell";

type Props = {
  firstName?: string;
  productName?: string;
  amount?: string;
  payUrl?: string;
  brandName?: string;
  note?: string | null;
};

// An admin sold a product to a buyer and sent them a pay link. Mirrors the pay
// CARD dropped into their Wielo inbox, so the offer reaches them whether or not
// they log in.
export default function ProductOffer({
  firstName = "there",
  productName = "your order",
  amount = "—",
  payUrl = "https://wielo.co.za",
  brandName = "Wielo",
  note = null,
}: Props) {
  return (
    <Shell
      preview={`${productName} — ${amount} to pay`}
      eyebrow="Your offer"
      title={productName}
      subtitle={`${amount} — pay when you're ready.`}
      pill={{ label: "OFFER", emoji: "🎁" }}
    >
      <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#052E1F" }}>
        Hi {firstName}, the {brandName} team has put this together for you.
      </Text>

      <div
        style={{
          background: "#F2F8F4",
          border: "1px solid #C7DCC9",
          borderRadius: 12,
          padding: 20,
          margin: "16px 0",
        }}
      >
        <Text
          style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#052E1F" }}
        >
          {productName}
        </Text>
        <Text
          style={{
            margin: "6px 0 0",
            fontSize: 24,
            fontWeight: 800,
            color: "#064E3B",
          }}
        >
          {amount}
        </Text>
      </div>

      {note ? (
        <Text style={{ margin: "0 0 16px", fontSize: 14, color: "#4A7C6A" }}>
          {note}
        </Text>
      ) : null}

      <Button href={payUrl}>Pay {amount} →</Button>

      <Text style={{ margin: "20px 0 0", fontSize: 13, color: "#4A7C6A" }}>
        This offer is also waiting in your {brandName} inbox, so you can pay it
        any time. Nothing is charged until you complete the payment yourself.
      </Text>
    </Shell>
  );
}
