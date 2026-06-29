import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";
import Layout from "../components/Layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wieloplatform.com";

type Props = {
  firstName: string;
};

export default function WelcomeHost({ firstName = "there" }: Props) {
  return (
    <Layout
      preview={`Welcome to Wielo, ${firstName}. Let's get your first listing live.`}
    >
      <Heading style={{ fontSize: 24, color: "#1B4D3E", margin: "0 0 16px" }}>
        Welcome to Wielo, {firstName} 👋
      </Heading>
      <Text>
        We're excited to have you running your direct-booking business on Wielo.
        You can create your first listing, set your availability, and start
        accepting bookings — all from one dashboard.
      </Text>
      <Text>Here's what to do next:</Text>
      <ul style={{ paddingLeft: 20 }}>
        <li>Complete your host profile and add a cover photo.</li>
        <li>Create your first accommodation listing.</li>
        <li>Connect Paystack or PayPal so guests can pay you directly.</li>
      </ul>
      <Button
        href={`${APP_URL}/dashboard`}
        style={{
          backgroundColor: "#1B4D3E",
          color: "#FFFFFF",
          padding: "12px 24px",
          borderRadius: "10px",
          fontWeight: 500,
          textDecoration: "none",
          display: "inline-block",
          marginTop: "16px",
        }}
      >
        Open my dashboard
      </Button>
      <Text style={{ marginTop: 24, color: "#6B7280", fontSize: 14 }}>
        Got stuck? Reply to this email and we'll get back to you within one
        working day.
      </Text>
    </Layout>
  );
}
