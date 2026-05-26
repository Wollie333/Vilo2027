import { Hr, Section, Text } from "@react-email/components";
import * as React from "react";

import Heading from "../components/Heading";
import Layout from "../components/Layout";

export type DigestItem = {
  title: string;
  body?: string | null;
  link?: string | null;
  created_at?: string;
};

type Props = {
  recipient_first_name?: string;
  cadence?: "daily" | "weekly";
  groups?: Array<{
    category_label: string;
    items: DigestItem[];
  }>;
};

export default function NotificationDigest({
  recipient_first_name = "there",
  cadence = "daily",
  groups = [],
}: Props) {
  const cadenceLabel = cadence === "weekly" ? "weekly" : "daily";
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Layout
      preview={`Your ${cadenceLabel} Vilo digest — ${totalItems} updates`}
    >
      <Heading>Your {cadenceLabel} digest</Heading>
      <Text>Hi {recipient_first_name},</Text>
      <Text>
        {totalItems === 0
          ? "Nothing new since your last digest."
          : `Here are the ${totalItems} updates from the last ${cadenceLabel === "weekly" ? "week" : "day"}.`}
      </Text>

      {groups.map((group, gi) => (
        <Section key={gi} style={{ marginTop: 24 }}>
          <Text
            style={{
              fontWeight: 700,
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#666",
              marginBottom: 8,
            }}
          >
            {group.category_label}
          </Text>
          {group.items.map((item, ii) => (
            <div key={ii} style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: 600, margin: 0 }}>
                {item.link ? (
                  <a
                    href={item.link}
                    style={{ color: "#1B4D3E", textDecoration: "underline" }}
                  >
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </Text>
              {item.body ? (
                <Text style={{ margin: "4px 0 0 0", color: "#555" }}>
                  {item.body}
                </Text>
              ) : null}
            </div>
          ))}
          {gi < groups.length - 1 ? (
            <Hr style={{ borderColor: "#eee", margin: "16px 0" }} />
          ) : null}
        </Section>
      ))}

      <Text style={{ marginTop: 32, color: "#888", fontSize: 12 }}>
        You receive these because digest mode is enabled for one or more
        categories in your notification preferences.
      </Text>
    </Layout>
  );
}
