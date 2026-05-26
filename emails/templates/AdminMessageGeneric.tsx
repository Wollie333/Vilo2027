import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import Heading from "../components/Heading";
import Layout from "../components/Layout";

type Props = {
  title?: string;
  body?: string;
  link_url?: string;
  link_label?: string;
};

export default function AdminMessageGeneric({
  title = "Message from Vilo",
  body = "",
  link_url,
  link_label,
}: Props) {
  return (
    <Layout preview={title}>
      <Heading>{title}</Heading>
      {body.split("\n").map((paragraph, idx) => (
        <Text key={idx} style={{ marginTop: idx === 0 ? 12 : 8 }}>
          {paragraph}
        </Text>
      ))}
      {link_url ? (
        <Section style={{ marginTop: 20 }}>
          <Button
            href={link_url}
            style={{
              backgroundColor: "#1B4D3E",
              color: "#ffffff",
              padding: "10px 18px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {link_label ?? "Open"}
          </Button>
        </Section>
      ) : null}
      <Text style={{ marginTop: 32, color: "#888", fontSize: 12 }}>
        Sent directly by the Vilo team.
      </Text>
    </Layout>
  );
}
