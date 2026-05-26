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

export default function BroadcastCritical({
  title = "Important announcement",
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
        <Section style={{ marginTop: 24 }}>
          <Button
            href={link_url}
            style={{
              backgroundColor: "#1B4D3E",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {link_label ?? "Read more"}
          </Button>
        </Section>
      ) : null}
      <Text style={{ marginTop: 32, color: "#888", fontSize: 12 }}>
        This is a platform-wide announcement from the Vilo team.
      </Text>
    </Layout>
  );
}
