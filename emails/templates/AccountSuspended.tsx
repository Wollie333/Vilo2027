import { Text } from "@react-email/components";
import * as React from "react";

import Heading from "../components/Heading";
import Layout from "../components/Layout";

type Props = {
  hostFirstName?: string;
  supportEmail?: string;
};

export default function AccountSuspended({
  hostFirstName = "there",
  supportEmail = "support@wieloplatform.com",
}: Props) {
  return (
    <Layout preview="Your Wielo account has been suspended following a review.">
      <Heading>Your account has been suspended</Heading>
      <Text>Hi {hostFirstName},</Text>
      <Text>
        Your Wielo account has been temporarily suspended following a review by
        our team. Your listings have been removed from the directory while the
        suspension is in place.
      </Text>
      <Text style={{ marginTop: 16 }}>
        If you believe this is an error or would like more information, please
        contact us at{" "}
        <a
          href={`mailto:${supportEmail}`}
          style={{ color: "#1B4D3E", textDecoration: "underline" }}
        >
          {supportEmail}
        </a>
        .
      </Text>
    </Layout>
  );
}
