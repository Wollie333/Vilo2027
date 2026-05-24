import { Heading as ReactEmailHeading } from "@react-email/components";
import * as React from "react";

export default function Heading({ children }: { children: React.ReactNode }) {
  return (
    <ReactEmailHeading
      style={{
        fontSize: 24,
        color: "#1B4D3E",
        margin: "0 0 16px",
        fontWeight: 700,
      }}
    >
      {children}
    </ReactEmailHeading>
  );
}
