import { Section, Text } from "@react-email/components";
import * as React from "react";

// Left-accent message/quote block in the Wielo email style — a soft panel with a
// green left border, for a host's note, a guest's message, or a highlighted
// callout inside Shell body content.

export default function MessageBlock({
  label,
  children,
}: {
  /** Optional small uppercase heading above the block. */
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Section style={styles.block}>
        <Text style={styles.text}>{children}</Text>
      </Section>
    </>
  );
}

const styles = {
  label: {
    margin: "0 0 10px",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#10B981",
    fontWeight: 700,
  },
  block: {
    backgroundColor: "#F8FBFA",
    borderLeft: "3px solid #10B981",
    padding: "16px 20px",
    marginBottom: "24px",
  },
  text: {
    margin: 0,
    fontSize: "14px",
    color: "#064E3B",
    lineHeight: "1.7",
  },
};
