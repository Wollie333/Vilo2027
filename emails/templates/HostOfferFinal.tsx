import { Hr, Section, Text } from "@react-email/components";
import * as React from "react";

import Button from "../components/Button";
import Heading from "../components/Heading";
import Layout from "../components/Layout";
import { APP_URL } from "../lib/appUrl";

type Props = {
  firstName?: string;
  planName?: string;
  monthlyPrice?: string | null;
  annualPrice?: string | null;
  annualSaving?: string | null;
  capabilities?: string[];
  subscribeUrl?: string;
  supportEmail?: string;
};

export default function HostOfferFinal({
  firstName = "there",
  planName = "a Wielo plan",
  monthlyPrice,
  annualPrice,
  subscribeUrl = `${APP_URL}/dashboard/settings/subscription`,
  supportEmail = "hello@wielo.co.za",
}: Props) {
  return (
    <Layout preview="Ready when you are — publish your listing on Wielo.">
      <Heading>Still keen, {firstName}?</Heading>
      <Text>
        Your Wielo account is ready to go — the only step left is choosing a
        plan so you can publish your listing and start taking direct bookings,
        with <strong>zero commission</strong> on any of them.
      </Text>

      {monthlyPrice && (
        <Section
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "16px 20px",
            margin: "8px 0 20px",
          }}
        >
          <Text style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {planName}
          </Text>
          <Text style={{ margin: "4px 0 0", fontSize: 14, color: "#111827" }}>
            {monthlyPrice}/month
            {annualPrice ? ` — or ${annualPrice}/year` : ""}
          </Text>
        </Section>
      )}

      <Button href={subscribeUrl}>Choose your plan</Button>

      <Hr style={{ borderColor: "#E5E7EB", margin: "24px 0 16px" }} />
      <Text style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
        If Wielo isn&rsquo;t the right fit right now, that&rsquo;s completely
        fine — no more nudges from us. Got a question first? Just reply, or
        email{" "}
        <a href={`mailto:${supportEmail}`} style={{ color: "#1B4D3E" }}>
          {supportEmail}
        </a>
        .
      </Text>
    </Layout>
  );
}
