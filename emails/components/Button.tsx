import { Button as ReactEmailButton } from "@react-email/components";
import * as React from "react";

const PRIMARY = "#1B4D3E";
const PRIMARY_HOVER = "#0D2B21";

/**
 * Branded primary button. Wraps @react-email's Button so every template
 * gets the same Vilo emerald + 10px radius treatment without copy-pasting
 * 8 lines of style.
 */
export default function Button({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const bg = variant === "primary" ? PRIMARY : "#FFFFFF";
  const color = variant === "primary" ? "#FFFFFF" : PRIMARY;
  const border =
    variant === "primary" ? "none" : `1px solid ${PRIMARY_HOVER}33`;
  return (
    <ReactEmailButton
      href={href}
      style={{
        backgroundColor: bg,
        color,
        padding: "12px 24px",
        borderRadius: "10px",
        fontWeight: 600,
        fontSize: "15px",
        textDecoration: "none",
        display: "inline-block",
        marginTop: "8px",
        border,
      }}
    >
      {children}
    </ReactEmailButton>
  );
}
